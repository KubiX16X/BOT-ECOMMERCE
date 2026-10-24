import fs from "node:fs";
import path from "node:path";
import { getConfig, loadEnv } from "../env";

// Logowanie do Allegro REST API przez device flow: użytkownik otwiera link z kodem i klika „Zezwól”.
// Tokeny trzymamy w DATA_DIR/allegro-token.json (poza repozytorium).

const AUTH_URL = "https://allegro.pl/auth/oauth";
export const API_URL = "https://api.allegro.pl";

export interface AllegroCredentials {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export interface AllegroTokens {
  access_token: string;
  refresh_token: string;
  /** Unix ms, kiedy access_token wygasa. */
  expires_at: number;
  scope?: string;
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export class AllegroAuthError extends Error {}

export function getAllegroCredentials(): AllegroCredentials {
  loadEnv();
  const clientId = process.env.ALLEGRO_CLIENT_ID?.trim();
  const clientSecret = process.env.ALLEGRO_CLIENT_SECRET?.trim();
  const userAgent = process.env.ALLEGRO_USER_AGENT?.trim();
  if (!clientId || !clientSecret || !userAgent) {
    throw new AllegroAuthError("Brak ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET lub ALLEGRO_USER_AGENT w pliku .env.");
  }
  return { clientId, clientSecret, userAgent };
}

function authHeaders(c: AllegroCredentials): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": c.userAgent,
  };
}

const tokenFile = () => path.join(getConfig().dataDir, "allegro-token.json");
const deviceFile = () => path.join(getConfig().dataDir, "allegro-device.json");

function writePrivate(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function loadTokens(): AllegroTokens | undefined {
  try {
    return JSON.parse(fs.readFileSync(tokenFile(), "utf8")) as AllegroTokens;
  } catch {
    return undefined;
  }
}

function toTokens(json: { access_token: string; refresh_token: string; expires_in: number | string; scope?: string }): AllegroTokens {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + Number(json.expires_in) * 1000,
    scope: json.scope,
  };
}

/** Krok 1: prosi Allegro o kod, który użytkownik potwierdza pod zwróconym linkiem. */
export async function startDeviceFlow(c = getAllegroCredentials()): Promise<DeviceCode> {
  const res = await fetch(`${AUTH_URL}/device`, {
    method: "POST",
    headers: authHeaders(c),
    body: new URLSearchParams({ client_id: c.clientId }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok || !json.device_code) {
    throw new AllegroAuthError(`Allegro odrzuciło prośbę o kod (HTTP ${res.status}): ${json.error_description ?? json.error ?? "nieznany błąd"}`);
  }
  const code: DeviceCode = {
    device_code: json.device_code,
    user_code: json.user_code!,
    verification_uri: json.verification_uri!,
    verification_uri_complete: json.verification_uri_complete!,
    expires_in: Number(json.expires_in),
    interval: Number(json.interval) || 5,
  };
  writePrivate(deviceFile(), { ...code, created_at: Date.now() });
  return code;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Krok 2: czeka, aż użytkownik kliknie „Zezwól”, i zapisuje tokeny. */
export async function waitForDeviceToken(c = getAllegroCredentials()): Promise<AllegroTokens> {
  const device = JSON.parse(fs.readFileSync(deviceFile(), "utf8")) as DeviceCode & { created_at: number };
  let interval = device.interval;
  const deadline = device.created_at + device.expires_in * 1000;
  while (Date.now() < deadline) {
    const url = `${AUTH_URL}/token?${new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: device.device_code,
    })}`;
    const res = await fetch(url, { method: "POST", headers: authHeaders(c) });
    const json = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (res.ok && json.access_token) {
      const tokens = toTokens(json as never);
      writePrivate(tokenFile(), tokens);
      fs.rmSync(deviceFile(), { force: true });
      return tokens;
    }
    if (json.error === "slow_down") interval += 5;
    else if (json.error !== "authorization_pending") {
      throw new AllegroAuthError(`Logowanie nieudane: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`);
    }
    await sleep(interval * 1000);
  }
  throw new AllegroAuthError("Kod wygasł – wygeneruj nowy link.");
}

/** Ważny access token; odświeża go, gdy kończy się ważność (refresh token działa 3 miesiące). */
export async function getAccessToken(c = getAllegroCredentials()): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new AllegroAuthError("Konto Allegro nie jest połączone – uruchom: npm run allegro -- polacz");
  if (tokens.expires_at - Date.now() > 5 * 60 * 1000) return tokens.access_token;
  const url = `${AUTH_URL}/token?${new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token })}`;
  const res = await fetch(url, { method: "POST", headers: authHeaders(c) });
  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok || !json.access_token) {
    throw new AllegroAuthError("Nie udało się odświeżyć dostępu do Allegro – połącz konto ponownie (npm run allegro -- polacz).");
  }
  const fresh = toTokens(json as never);
  writePrivate(tokenFile(), fresh);
  return fresh.access_token;
}

/** Zapytanie do Allegro REST API z wymaganymi nagłówkami. */
export async function allegroApi<T = unknown>(apiPath: string, init: RequestInit = {}): Promise<T> {
  const c = getAllegroCredentials();
  const res = await fetch(`${API_URL}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getAccessToken(c)}`,
      Accept: "application/vnd.allegro.public.v1+json",
      "Accept-Language": "pl-PL",
      "User-Agent": c.userAgent,
      ...(init.body ? { "Content-Type": "application/vnd.allegro.public.v1+json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new AllegroAuthError(`Allegro API ${apiPath}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}
