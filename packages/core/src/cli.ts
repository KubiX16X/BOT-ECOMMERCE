// Generator z linii poleceń, np.:
//   npm run generuj -- --zdjecie foto.jpg --opis opis.txt --kategoria "Dom i Ogród > Ogród > Grille" --dostawa 2-4
//   npm run generuj -- --demo            (przykładowy projektor bez kluczy API)
import fs from "node:fs";
import { parseArgs } from "node:util";
import { DEMO_COPY } from "./demo";
import { findOlxLimit } from "./olx/limits";
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
  },
});

const delivery = parseDelivery(values.dostawa!);
if (!delivery) {
  console.error('Zły format --dostawa, użyj np. "2-4".');
  process.exit(1);
}

const category = values.kategoria;
const seriesCount = values.serie ? Number(values.serie) : (category && findOlxLimit(category)) || (values.demo ? 2 : 1);
if (!values.serie && category && !findOlxLimit(category)) {
  console.warn(`Nie znam limitu OLX dla "${category}" – generuję 1 serię. Podaj --serie N albo zapisz limit w data/olx-limity.json.`);
}

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
    copy: values.demo ? DEMO_COPY : undefined,
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
