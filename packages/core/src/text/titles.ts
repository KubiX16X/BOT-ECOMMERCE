// Tytuły ofert: każde słowo od wielkiej litery, bez spamu znaków, przycięte
// do limitu platformy wyłącznie na granicy słów.

export type Platform = "olx" | "allegro" | "revion";

export const TITLE_LIMITS: Record<Platform, number> = {
  olx: 70,
  allegro: 75,
  revion: 90,
};

// Pisownia, której nie ruszamy (skróty, jednostki, marki z nietypową wielkością liter).
const PRESERVED = [
  "TV", "4K", "8K", "HD", "FHD", "UHD", "HDR", "LED", "LCD", "OLED", "QLED", "AMOLED", "IPS",
  "HDMI", "USB", "USB-C", "AV", "SD", "SSD", "HDD", "RAM", "CPU", "GPU", "GPS", "NFC", "RGB",
  "UV", "IR", "AGD", "RTV", "PC", "PS4", "PS5", "XL", "XXL", "XS", "LTE", "5G", "4G", "DVD",
  "MP3", "MP4", "ANC", "TWS", "DIY", "BBQ", "LPG", "PVC", "ABS", "AAA", "AA", "DC", "AC", "EU",
  "IP65", "IP67", "IP68", "WiFi", "Wi-Fi", "iPhone", "iPad", "iMac", "iOS", "MacBook", "AirPods",
  "AirPlay", "PlayStation", "YouTube", "TikTok", "mAh", "GHz", "MHz", "Hz", "kW", "kWh", "Wh",
];
const PRESERVED_MAP = new Map(PRESERVED.map((w) => [w.toLocaleLowerCase("pl"), w]));

// Jednostki po liczbie: "5000mah" -> "5000mAh", "4k" -> "4K".
const UNITS = new Map(
  ["mAh", "GHz", "MHz", "Hz", "kW", "kWh", "Wh", "W", "V", "K", "GB", "TB", "MB", "cm", "mm", "ml", "kg", "L"].map(
    (u) => [u.toLocaleLowerCase("pl"), u],
  ),
);

// Krótkie polskie słowa, które w tytule pisanym CAPSEM nie są skrótami.
const SHORT_WORDS = new Set([
  "do", "na", "dla", "z", "ze", "w", "we", "i", "od", "po", "pod", "nad", "bez", "u", "o", "a",
  "lub", "set", "mini", "max", "pro", "kit",
]);

const LETTER = /\p{L}/u;

function capitalizeFirst(word: string): string {
  const i = word.search(LETTER);
  if (i === -1) return word;
  return word.slice(0, i) + word.charAt(i).toLocaleUpperCase("pl") + word.slice(i + 1);
}

function isAllCaps(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toLocaleUpperCase("pl") && letters !== letters.toLocaleLowerCase("pl");
}

export function titleCaseWord(word: string): string {
  if (!word) return word;
  const lower = word.toLocaleLowerCase("pl");
  const preserved = PRESERVED_MAP.get(lower);
  if (preserved) return preserved;

  if (/\d/.test(word)) {
    const m = /^([\d.,x×/]+)([\p{L}]+)$/u.exec(word);
    if (m) {
      const unit = UNITS.get(m[2]!.toLocaleLowerCase("pl"));
      if (unit) return m[1] + unit;
    }
    return capitalizeFirst(word);
  }

  if (word.includes("-")) {
    return word.split("-").map(titleCaseWord).join("-");
  }

  if (isAllCaps(word)) {
    const letters = lower.replace(/[^\p{L}]/gu, "");
    if (letters.length <= 3 && !SHORT_WORDS.has(letters)) return word; // skrót / marka, np. HP, JBL
    return capitalizeFirst(lower);
  }

  return capitalizeFirst(word);
}

/** Usuwa emoji i znaki spoza bezpiecznego zestawu, zbija spacje. */
export function cleanTitle(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} \-+"'/,.&%()×]/gu, " ")
    .replace(/([!?.,\-+])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Usuwa powtórzone słowa (bez względu na wielkość liter), zostawia pierwsze wystąpienie. */
export function dedupeWords(words: string[]): string[] {
  const seen = new Set<string>();
  return words.filter((w) => {
    const key = w.toLocaleLowerCase("pl");
    if (key.replace(/[^\p{L}]/gu, "").length < 3) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const DANGLING = new Set(["do", "na", "dla", "z", "ze", "w", "we", "i", "od", "po", "lub", "-", "+", ",", "/", "&"]);

/** Przycina do limitu, zdejmując całe słowa od końca (najważniejsze frazy są na początku). */
export function fitToLimit(words: string[], max: number): string[] {
  const out = [...words];
  const len = () => out.join(" ").length;
  while (out.length > 1 && len() > max) out.pop();
  while (out.length > 1 && DANGLING.has(out[out.length - 1]!.toLocaleLowerCase("pl"))) out.pop();
  return out;
}

export interface FormattedTitle {
  title: string;
  length: number;
  limit: number;
}

export function formatTitle(raw: string, platform: Platform): FormattedTitle {
  const limit = TITLE_LIMITS[platform];
  const words = dedupeWords(cleanTitle(raw).split(" ").filter(Boolean).map(titleCaseWord));
  const title = fitToLimit(words, limit).join(" ");
  return { title, length: title.length, limit };
}

/**
 * Formatuje warianty tytułów dla kolejnych serii ogłoszeń OLX. Każda seria musi
 * mieć inny tytuł – duplikat zastępujemy kolejnym kandydatem z listy.
 */
export function formatSeriesTitles(candidates: string[], count: number, platform: Platform = "olx"): FormattedTitle[] {
  const out: FormattedTitle[] = [];
  const used = new Set<string>();
  for (const c of candidates) {
    if (out.length === count) break;
    const t = formatTitle(c, platform);
    const key = t.title.toLocaleLowerCase("pl");
    if (!t.title || used.has(key)) continue;
    used.add(key);
    out.push(t);
  }
  return out;
}
