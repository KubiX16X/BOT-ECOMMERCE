import JSZip from "jszip";
import type { ProductCopy } from "../copy/schema";
import type { ListingTexts } from "../copy/listing";
import type { GeneratedImage, ImageFailure } from "../images/series";
import { slugify } from "../text/format";

export interface PackContents {
  slug: string;
  copy: ProductCopy;
  listings: ListingTexts;
  images: GeneratedImage[];
  failures: ImageFailure[];
  meta: Record<string, unknown>;
  warnings: string[];
}

/** Zdjęcia jednej serii w kolejności do wgrania: 5 scen + packshot. */
export function seriesImages(images: GeneratedImage[], series: number): GeneratedImage[] {
  const packshot = images.find((i) => i.kind === "packshot");
  return [...images.filter((i) => i.series === series), ...(packshot ? [packshot] : [])];
}

/** Allegro: packshot na białym tle musi być pierwszy, potem sceny z serii 1. */
export function allegroImages(images: GeneratedImage[]): GeneratedImage[] {
  const packshot = images.find((i) => i.kind === "packshot");
  return [...(packshot ? [packshot] : []), ...images.filter((i) => i.series === 1)];
}

function readme(p: PackContents): string {
  const lines = [
    `PACZKA OFERTY: ${p.copy.productName}`,
    "",
    "OLX – każdy folder olx/seria-N to osobne ogłoszenie:",
    ...p.listings.olx.map((s) => `  Seria ${s.series} (${s.theme}): ${s.title.title}  [${s.title.length}/${s.title.limit}]`),
    "  Wgraj zdjęcia w kolejności nazw plików (01 = okładka), wklej tytul.txt i opis.txt.",
    "",
    `ALLEGRO: ${p.listings.allegro.title.title}  [${p.listings.allegro.title.length}/${p.listings.allegro.title.limit}]`,
    "  Pierwsze zdjęcie to packshot na białym tle (wymóg Allegro). Opis bez telefonu i płatności poza Allegro.",
    "",
    `REVION: ${p.listings.revion.title.title}`,
    "",
    `Sugerowana kategoria OLX: ${p.copy.olxCategorySuggestion}`,
  ];
  if (p.warnings.length) lines.push("", "UWAGI – SPRAWDŹ PRZED WYSTAWIENIEM:", ...p.warnings.map((w) => `  - ${w}`));
  if (p.failures.length) {
    lines.push("", "NIE UDAŁO SIĘ WYGENEROWAĆ:", ...p.failures.map((f) => `  - ${f.series ? `seria ${f.series}` : "packshot"} / ${f.kind}: ${f.error}`));
  }
  return lines.join("\n") + "\n";
}

export async function buildOfferZip(p: PackContents): Promise<Buffer> {
  const zip = new JSZip();
  const root = zip.folder(p.slug)!;
  root.file("CZYTAJ.txt", readme(p));
  root.file(
    "oferta.json",
    JSON.stringify({ meta: p.meta, copy: p.copy, listings: p.listings, warnings: p.warnings, failures: p.failures.map(({ prompt: _, ...f }) => f) }, null, 2),
  );

  for (const s of p.listings.olx) {
    const dir = root.folder(`olx/seria-${s.series}-${slugify(s.theme, 30)}`)!;
    dir.file("tytul.txt", s.title.title + "\n");
    dir.file("opis.txt", s.description + "\n");
    for (const img of seriesImages(p.images, s.series)) dir.file(img.fileName, img.data);
  }

  const allegro = root.folder("allegro")!;
  allegro.file("tytul.txt", p.listings.allegro.title.title + "\n");
  allegro.file("opis.txt", p.listings.allegro.description + "\n");
  allegro.file("opis.html", p.listings.allegro.html + "\n");
  allegroImages(p.images).forEach((img, i) => allegro.file(`${String(i + 1).padStart(2, "0")}-${img.fileName.replace(/^\d+-/, "")}`, img.data));

  const revion = root.folder("revion")!;
  revion.file("tytul.txt", p.listings.revion.title.title + "\n");
  revion.file("opis.html", p.listings.revion.html + "\n");

  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}
