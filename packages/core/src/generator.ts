import fs from "node:fs";
import path from "node:path";
import { normalizeImagePlan, writeProductCopy } from "./copy/copywriter";
import { renderListings, type ListingTexts } from "./copy/listing";
import type { ProductCopy } from "./copy/schema";
import { getConfig } from "./env";
import { generateImageSeries, type GeneratedImage, type ImageFailure } from "./images/series";
import { buildOfferZip } from "./pack/zip";
import { slugify } from "./text/format";

export interface GeneratorInput {
  photos: Buffer[];
  productName?: string;
  /** Tekst skopiowany z oferty źródłowej (opis, parametry). */
  sourceText?: string;
  /** Link do oferty, z której kupujesz (do zapisania w paczce). */
  sourceUrl?: string;
  olxCategory?: string;
  /** Liczba darmowych ogłoszeń w kategorii OLX = liczba serii. */
  seriesCount: number;
  delivery: { min: number; max: number };
  price?: number;
}

export interface GeneratorProgress {
  stage: "copy" | "images" | "pack";
  message: string;
  done?: number;
  total?: number;
}

export interface GenerateOptions {
  onProgress?: (p: GeneratorProgress) => void;
  /** Bez zdjęć AI (np. brak klucza Gemini albo tylko teksty). */
  skipImages?: boolean;
  /** Gotowe teksty (tryb demo / ponowne generowanie zdjęć). */
  copy?: ProductCopy;
  signal?: AbortSignal;
}

export interface OfferPack {
  id: string;
  createdAt: string;
  slug: string;
  copy: ProductCopy;
  listings: ListingTexts;
  images: GeneratedImage[];
  failures: ImageFailure[];
  warnings: string[];
  zip: Buffer;
}

export const MAX_SERIES = 10;

export function estimateImageCount(seriesCount: number): number {
  return seriesCount * 5 + 1;
}

export async function generateOffer(input: GeneratorInput, opts: GenerateOptions = {}): Promise<OfferPack> {
  const config = getConfig();
  const seriesCount = Math.min(Math.max(1, Math.floor(input.seriesCount)), MAX_SERIES);
  const progress = opts.onProgress ?? (() => {});

  progress({ stage: "copy", message: "Piszę tytuły, opisy i plan zdjęć…" });
  const copy = opts.copy
    ? normalizeImagePlan(opts.copy, seriesCount)
    : await writeProductCopy({
      photos: input.photos,
      productName: input.productName,
      sourceText: input.sourceText,
      olxCategory: input.olxCategory,
      seriesCount,
    });

  const listings = renderListings(copy, {
    seriesCount,
    delivery: input.delivery,
    sellerPhone: config.sellerPhone,
    competitorKeywords: config.olxCompetitorKeywords,
  });

  const warnings = [...copy.warnings];
  let images: GeneratedImage[] = [];
  let failures: ImageFailure[] = [];

  if (opts.skipImages) {
    warnings.push("Zdjęcia AI pominięte (tryb tylko teksty).");
  } else if (!config.geminiApiKey) {
    warnings.push("Brak GEMINI_API_KEY w .env – paczka zawiera tylko teksty.");
  } else if (input.photos.length === 0) {
    warnings.push("Nie wysłano zdjęcia produktu – zdjęcia AI pominięte.");
  } else {
    const total = estimateImageCount(seriesCount);
    progress({ stage: "images", message: `Generuję zdjęcia (0/${total})…`, done: 0, total });
    const result = await generateImageSeries(input.photos, copy.imagePlan, {
      apiKey: config.geminiApiKey,
      model: config.geminiImageModel,
      signal: opts.signal,
      onProgress: (done, t) => progress({ stage: "images", message: `Generuję zdjęcia (${done}/${t})…`, done, total: t }),
    });
    images = result.images;
    failures = result.failures;
    if (failures.length) warnings.push(`${failures.length} zdjęć nie udało się wygenerować – szczegóły w CZYTAJ.txt.`);
  }

  progress({ stage: "pack", message: "Pakuję ZIP…" });
  const createdAt = new Date();
  const slug = slugify(copy.storeTitle || copy.productName);
  const id = `${createdAt.toISOString().slice(0, 10)}-${slug}-${createdAt.getTime().toString(36)}`;
  const zip = await buildOfferZip({
    slug,
    copy,
    listings,
    images,
    failures,
    warnings,
    meta: {
      id,
      createdAt: createdAt.toISOString(),
      productName: input.productName,
      sourceUrl: input.sourceUrl,
      olxCategory: input.olxCategory,
      seriesCount,
      delivery: input.delivery,
      price: input.price,
      imageModel: config.geminiImageModel,
      textModel: config.claudeModel,
    },
  });

  return { id, createdAt: createdAt.toISOString(), slug, copy, listings, images, failures, warnings, zip };
}

/** Zapisuje ZIP i JSON w DATA_DIR/paczki/<id>/. Zwraca ścieżkę do ZIP-a. */
export function savePack(pack: OfferPack): string {
  const dir = path.join(getConfig().dataDir, "paczki", pack.id);
  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, `${pack.slug}.zip`);
  fs.writeFileSync(zipPath, pack.zip);
  fs.writeFileSync(
    path.join(dir, "oferta.json"),
    JSON.stringify({ id: pack.id, createdAt: pack.createdAt, copy: pack.copy, listings: pack.listings, warnings: pack.warnings }, null, 2),
  );
  return zipPath;
}
