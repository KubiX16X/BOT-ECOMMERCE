import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../env";

// Ile darmowych ogłoszeń przysługuje w danej kategorii OLX = ile serii zdjęć i tytułów generujemy.
// Tabela OLX dla kont prywatnych: config/olx-limity.json (pomoc.olx.pl → „Limity darmowych ogłoszeń”).
// Twoje poprawki: DATA_DIR/olx-limity.json (liczby, mają pierwszeństwo).

export interface OlxLimit {
  /** null = bez limitu */
  limit: number | null;
  /** okres, w którym obowiązuje limit */
  dni: number;
}

export type OlxLimits = Record<string, number>;

type RawLimit = number | { limit: number | null; dni?: number };

/** Ile serii generować w kategorii bez limitu – każda seria to ok. 7 zdjęć Gemini. */
export const UNLIMITED_SERIES = 3;

function files() {
  const c = getConfig();
  return { defaults: path.join(c.configDir, "olx-limity.json"), user: path.join(c.dataDir, "olx-limity.json") };
}

function readJson(file: string): Record<string, RawLimit> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, RawLimit>;
  } catch {
    return {};
  }
}

function toLimit(raw: RawLimit): OlxLimit {
  return typeof raw === "number" ? { limit: raw, dni: 30 } : { limit: raw.limit, dni: raw.dni ?? 30 };
}

/** "dom i ogród / koce" i "Dom i Ogród > Koce" → ten sam klucz. */
export function normalizeCategory(name: string): string {
  return name
    .toLocaleLowerCase("pl")
    .replace(/\s*[/⁄>]\s*/g, " > ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getOlxLimitTable(): Record<string, OlxLimit> {
  const f = files();
  const table: Record<string, OlxLimit> = {};
  for (const [k, v] of Object.entries(readJson(f.defaults))) table[k] = toLimit(v);
  for (const [k, v] of Object.entries(readJson(f.user))) {
    const existing = Object.keys(table).find((t) => normalizeCategory(t) === normalizeCategory(k));
    table[existing ?? k] = toLimit(v);
  }
  return table;
}

export function seriesForLimit(limit: OlxLimit): number {
  return limit.limit === null ? UNLIMITED_SERIES : Math.max(0, limit.limit);
}

/** Liczba serii dla każdej kategorii (do list wyboru). */
export function getOlxLimits(): OlxLimits {
  return Object.fromEntries(Object.entries(getOlxLimitTable()).map(([k, v]) => [k, seriesForLimit(v)]));
}

/** Tylko kategorie zapisane przez użytkownika (krótka lista do przycisków w bocie). */
export function getUserOlxLimits(): OlxLimits {
  return Object.fromEntries(Object.entries(readJson(files().user)).map(([k, v]) => [k, seriesForLimit(toLimit(v))]));
}

export interface OlxCategoryMatch {
  category: string;
  limit: OlxLimit;
}

/** Wyszukuje kategorie po fragmencie nazwy, np. "koce" albo "zabawki". */
export function searchOlxCategories(query: string, max = 10): OlxCategoryMatch[] {
  const q = normalizeCategory(query);
  if (!q) return [];
  return Object.entries(getOlxLimitTable())
    .filter(([k]) => normalizeCategory(k).includes(q))
    .slice(0, max)
    .map(([category, limit]) => ({ category, limit }));
}

/** Pełna ścieżka albo jednoznaczna końcówka ("Koce" → "Dom i Ogród > Wyposażenie wnętrz > Koce"). */
export function findOlxCategory(query: string): OlxCategoryMatch | undefined {
  const q = normalizeCategory(query);
  if (!q) return undefined;
  const entries = Object.entries(getOlxLimitTable());
  const exact = entries.find(([k]) => normalizeCategory(k) === q);
  if (exact) return { category: exact[0], limit: exact[1] };
  const suffix = entries.filter(([k]) => normalizeCategory(k).endsWith(` > ${q}`));
  if (suffix.length === 1) return { category: suffix[0]![0], limit: suffix[0]![1] };
  return undefined;
}

export function findOlxLimit(category: string): number | undefined {
  const match = findOlxCategory(category);
  return match ? seriesForLimit(match.limit) : undefined;
}

export function describeOlxLimit(limit: OlxLimit): string {
  if (limit.limit === null) return "bez limitu";
  if (limit.limit === 0) return "brak darmowych ogłoszeń";
  return `${limit.limit} darmowe / ${limit.dni} dni`;
}

export function setOlxLimit(category: string, freeAds: number): void {
  if (!Number.isInteger(freeAds) || freeAds < 1 || freeAds > 20) throw new Error("Limit musi być liczbą od 1 do 20.");
  const f = files();
  const current = readJson(f.user);
  current[category.trim()] = freeAds;
  fs.mkdirSync(path.dirname(f.user), { recursive: true });
  fs.writeFileSync(f.user, JSON.stringify(current, null, 2) + "\n");
}
