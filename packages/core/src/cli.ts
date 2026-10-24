// Generator z linii poleceń, np.:
//   npm run generuj -- --zdjecie foto.jpg --opis opis.txt --kategoria "Dom i Ogród > Ogród > Grille" --dostawa 2-4
//   npm run generuj -- --demo            (przykładowy projektor bez kluczy API)
//   npm run generuj -- --teksty teksty.json --zdjecie foto.jpg   (gotowe teksty zamiast API Claude)
import fs from "node:fs";
import { parseArgs } from "node:util";
import { ProductCopySchema } from "./copy/schema";
import { DEMO_COPY } from "./demo";
import { describeOlxLimit, findOlxCategory, searchOlxCategories, seriesForLimit } from "./olx/limits";
import { generateOffer, savePack } from "./generator";
import { parseDelivery } from "./text/format";

const { values } = parseArgs({
  options: {
    zdjecie: { type: "string", multiple: true, default: [] },
    nazwa: { type: "string" },
    opis: { type: "string" },
    link: { type: "string" },
    kategoria: { type: "string" },
    serie: { type: "string" },
    dostawa: { type: "string", default: "2-4" },
    cena: { type: "string" },
    "bez-zdjec": { type: "boolean", default: false },
    demo: { type: "boolean", default: false },
    teksty: { type: "string" },
  },
});

// Teksty napisane poza API (np. w rozmowie z Claude) – ten sam format co odpowiedź copywritera.
const readyCopy = values.teksty ? ProductCopySchema.parse(JSON.parse(fs.readFileSync(values.teksty, "utf8"))) : values.demo ? DEMO_COPY : undefined;

const delivery = parseDelivery(values.dostawa!);
if (!delivery) {
  console.error('Zły format --dostawa, użyj np. "2-4".');
  process.exit(1);
}

// Kategoria OLX: pełna ścieżka albo jej końcówka ("Koce"); liczba serii z tabeli limitów OLX.
const match = values.kategoria ? findOlxCategory(values.kategoria) : undefined;
const category = match?.category ?? values.kategoria;
if (values.kategoria && !match) {
  const hints = searchOlxCategories(values.kategoria, 5).map((m) => m.category);
  console.warn(`Nie znam kategorii OLX "${values.kategoria}".${hints.length ? ` Może: ${hints.join(" | ")}` : ""}`);
}
if (match) console.log(`Kategoria OLX: ${match.category} – ${describeOlxLimit(match.limit)}`);
if (match?.limit.limit === 0) console.warn("W tej kategorii nie ma darmowych ogłoszeń – generuję 1 serię.");
const seriesCount = values.serie ? Number(values.serie) : (match && seriesForLimit(match.limit)) || (values.demo ? 2 : 1);

const pack = await generateOffer(
  {
    photos: values.zdjecie!.map((f) => fs.readFileSync(f)),
    productName: values.nazwa,
    sourceText: values.opis ? fs.readFileSync(values.opis, "utf8") : undefined,
    sourceUrl: values.link,
    olxCategory: category,
    seriesCount,
    delivery,
    price: values.cena ? Number(values.cena.replace(",", ".")) : undefined,
  },
  {
    copy: readyCopy,
    skipImages: values["bez-zdjec"],
    onProgress: (p) => console.log(`• ${p.message}`),
  },
);

const zipPath = savePack(pack);
console.log("");
for (const s of pack.listings.olx) console.log(`OLX seria ${s.series} (${s.theme}): ${s.title.title} [${s.title.length}/70]`);
console.log(`Allegro: ${pack.listings.allegro.title.title} [${pack.listings.allegro.title.length}/75]`);
console.log(`Zdjęcia: ${pack.images.length}, błędy: ${pack.failures.length}`);
for (const w of pack.warnings) console.log(`Uwaga: ${w}`);
console.log(`\nPaczka: ${zipPath}`);
