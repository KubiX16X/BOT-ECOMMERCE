/** "666079181" / "+48 666 079 181" -> "6-6-6-0-7-9-1-8-1" (zapis używany w opisach OLX). */
export function dashedPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("48")) digits = digits.slice(2);
  return digits.split("").join("-");
}

/** Zakres dni dostawy w formie do opisu, np. "2–4 dni robocze". */
export function deliveryText(min: number, max: number): string {
  const days = (n: number) => (n === 1 ? "dzień roboczy" : n >= 2 && n <= 4 ? "dni robocze" : "dni roboczych");
  if (min === max) return `${min} ${days(min)}`;
  return `${min}–${max} ${days(max)}`;
}

/** Parsuje "2-4", "2–4", "3" -> { min, max }. */
export function parseDelivery(input: string): { min: number; max: number } | null {
  const m = /^\s*(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?\s*$/.exec(input);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (min < 1 || max < min || max > 60) return null;
  return { min, max };
}

/** Bezpieczna nazwa pliku/folderu: "Mini Projektor 4K" -> "mini-projektor-4k". */
export function slugify(text: string, maxLength = 60): string {
  const map: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return (
    text
      .toLocaleLowerCase("pl")
      .replace(/[ąćęłńóśźż]/g, (c) => map[c] ?? c)
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength)
      .replace(/-+$/g, "") || "oferta"
  );
}
