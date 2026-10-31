// Zdjęcia na Vinted/Szafę (Gemini): rzecz na manekinie i na modelu, na Twoim tle, np.:
//   npm run vinted -- --zdjecie bluza.jpg --tlo pokoj.jpg --nazwa "bluza nike" --opis "navy Nike hoodie, oversize" --model "adult man, size L, average build"
//   npm run vinted -- --zdjecie buty.jpg --typ buty --nazwa "buty adidas"
//   npm run vinted -- --zdjecie bluza.jpg --nazwa "bluza nike" --tylko 2      (jeszcze raz tylko ujęcie nr 2)
// Tło podajesz raz – zapisuje się w DATA_DIR/vinted/tlo.jpg i jest używane w kolejnych ogłoszeniach.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getConfig } from "../env";
import { slugify } from "../text/format";
import { generateVintedPhotos, VINTED_SHOTS, type VintedItemType } from "./photos";

const { values } = parseArgs({
  options: {
    zdjecie: { type: "string", multiple: true, default: [] },
    tlo: { type: "string" },
    "bez-tla": { type: "boolean", default: false },
    typ: { type: "string", default: "ubranie" },
    nazwa: { type: "string", default: "rzecz" },
    opis: { type: "string" },
    model: { type: "string" },
    tylko: { type: "string" },
  },
});

const config = getConfig();
if (!config.geminiApiKey) {
  console.error("Brak GEMINI_API_KEY w pliku .env.");
  process.exit(1);
}
if (!values.zdjecie!.length) {
  console.error("Podaj zdjęcie rzeczy: --zdjecie plik.jpg");
  process.exit(1);
}
if (!(values.typ! in VINTED_SHOTS)) {
  console.error('--typ musi być "ubranie" albo "buty".');
  process.exit(1);
}

const vintedDir = path.join(config.dataDir, "vinted");
const savedBackground = path.join(vintedDir, "tlo.jpg");
fs.mkdirSync(vintedDir, { recursive: true });
if (values.tlo) fs.copyFileSync(values.tlo, savedBackground);
const background = !values["bez-tla"] && fs.existsSync(savedBackground) ? fs.readFileSync(savedBackground) : undefined;
console.log(background ? "Tło: Twoje zdjęcie (data/vinted/tlo.jpg)" : "Tło: domyślne (kremowa ściana, jasna podłoga)");

const outDir = path.join(vintedDir, `${new Date().toISOString().slice(0, 10)}-${slugify(values.nazwa!)}`);
fs.mkdirSync(outDir, { recursive: true });

// Poprawiamy np. samo ujęcie 3 – osoba i strój z gotowego ujęcia 2, żeby modelka się nie zmieniła.
const only = values.tylko?.split(",").map(Number);
const shots = VINTED_SHOTS[values.typ as VintedItemType];
const firstModel = shots.findIndex((s) => s.withModel);
const firstModelFile = path.join(outDir, `${shots[firstModel]!.file}.jpg`);
const modelReference = only?.length && !only.includes(firstModel + 1) && fs.existsSync(firstModelFile) ? fs.readFileSync(firstModelFile) : undefined;

const { images, failures } = await generateVintedPhotos(
  {
    photos: values.zdjecie!.map((f) => fs.readFileSync(f)),
    background,
    type: values.typ as VintedItemType,
    description: values.opis,
    model: values.model,
    only,
    modelReference,
  },
  {
    apiKey: config.geminiApiKey,
    model: config.geminiImageModel,
    onProgress: (done, total) => console.log(`• zdjęcie ${done}/${total}`),
  },
);

// Ponowne ujęcie nie nadpisuje poprzedniego: 2-model.jpg → 2-model-v2.jpg, żeby dało się porównać.
for (const img of images) {
  const { name, ext } = path.parse(img.file);
  let file = path.join(outDir, img.file);
  for (let v = 2; fs.existsSync(file); v++) file = path.join(outDir, `${name}-v${v}${ext}`);
  fs.writeFileSync(file, img.data);
  console.log(`Zapisano: ${file}`);
}
for (const f of failures) console.log(`Nie udało się: ${f.file} – ${f.error}`);
