import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildKeywordsLine, loadTemplates, renderListings } from "../src/copy/listing";
import { DEMO_COPY } from "../src/demo";

const templates = loadTemplates(path.resolve(import.meta.dirname, "../../../config/szablony"));
const opts = { seriesCount: 2, delivery: { min: 2, max: 4 }, sellerPhone: "666079181", competitorKeywords: true };

function order(text: string, markers: string[]): number[] {
  return markers.map((m) => text.indexOf(m));
}

describe("renderListings", () => {
  const r = renderListings(DEMO_COPY, opts, templates);

  it("OLX: sekcje w kolejności szablonu sprzedawcy", () => {
    const d = r.olx[0]!.description;
    const idx = order(d, [
      "KONTAKT TEL.: 6-6-6-0-7-9-1-8-1",
      "◼ Produkt fabrycznie nowy",
      'MINI PROJEKTOR RZUTNIK ANDROID 11 SMART TV 4K WIFI KINO DOMOWE 130"',
      "Telewizory to już przeszłość",
      "DLACZEGO WARTO:",
      "SPECYFIKACJA:",
      "Zestaw przeznaczony",
      "ZAWARTOŚĆ ZESTAWU:",
      "WYSYŁKA I PŁATNOŚĆ:",
      "samsung freestyle zamiennik",
    ]);
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(d).toContain("1.  Projektor Heelly");
    expect(d).toContain("2–4 dni robocze");
  });

  it("OLX: każda seria ma inny tytuł i tytuł w opisie", () => {
    expect(r.olx).toHaveLength(2);
    expect(r.olx[0]!.title.title).not.toBe(r.olx[1]!.title.title);
    expect(r.olx[1]!.description).toContain(r.olx[1]!.title.title.toLocaleUpperCase("pl"));
    expect(r.olx.every((s) => s.title.length <= 70)).toBe(true);
  });

  it("Allegro: bez telefonu, BLIK-a i bloku słów kluczowych", () => {
    for (const text of [r.allegro.description, r.allegro.html]) {
      expect(text).not.toMatch(/KONTAKT|BLIK|6-6-6|samsung/i);
    }
    expect(r.allegro.title.length).toBeLessThanOrEqual(75);
    expect(r.allegro.html).toContain("<h2>Specyfikacja</h2>");
    expect(r.allegro.html).toContain("Android/iOS");
  });

  it("bez telefonu w .env pomija linie kontaktowe", () => {
    const noPhone = renderListings(DEMO_COPY, { ...opts, sellerPhone: undefined }, templates);
    expect(noPhone.olx[0]!.description).not.toContain("KONTAKT TEL.");
    expect(noPhone.olx[0]!.description.startsWith("◼ Produkt fabrycznie nowy")).toBe(true);
  });

  it("frazy z cudzymi markami tylko gdy włączone", () => {
    expect(buildKeywordsLine(DEMO_COPY, false)).not.toContain("samsung");
    expect(buildKeywordsLine(DEMO_COPY, true)).toContain("samsung freestyle zamiennik");
  });
});
