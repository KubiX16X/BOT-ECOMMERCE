import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../env";

// Ile darmowych ogłoszeń masz w danej kategorii OLX = ile serii zdjęć i tytułów generujemy.
// Startowe wartości: config/olx-limity.json, Twoje zmiany: DATA_DIR/olx-limity.json.

export type OlxLimits = Record<string, number>;

function files() {
  const c = getConfig();
  return { defaults: path.join(c.configDir, "olx-limity.json"), user: path.join(c.dataDir, "olx-limity.json") };
}

function readJson(file: string): OlxLimits {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as OlxLimits;
  } catch {
    return {};
  }
}

export function getOlxLimits(): OlxLimits {
  const f = files();
  return { ...readJson(f.defaults), ...readJson(f.user) };
}

export function findOlxLimit(category: string): number | undefined {
  const key = category.trim().toLocaleLowerCase("pl");
  const entry = Object.entries(getOlxLimits()).find(([k]) => k.toLocaleLowerCase("pl") === key);
  return entry?.[1];
}

export function setOlxLimit(category: string, freeAds: number): void {
  if (!Number.isInteger(freeAds) || freeAds < 1 || freeAds > 20) throw new Error("Limit musi być liczbą od 1 do 20.");
  const f = files();
  const current = readJson(f.user);
  current[category.trim()] = freeAds;
  fs.mkdirSync(path.dirname(f.user), { recursive: true });
  fs.writeFileSync(f.user, JSON.stringify(current, null, 2) + "\n");
}
