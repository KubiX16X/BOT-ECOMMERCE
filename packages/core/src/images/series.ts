import sharp from "sharp";
import type { ImagePlan, ShotKind } from "../copy/schema";
import { generateGeminiImage, ImageGenerationError, type AspectRatio } from "./gemini";

export type ImageKind = ShotKind | "packshot";

export const SHOT_FILE_NAMES: Record<ImageKind, string> = {
  hero: "01-okladka",
  in_use: "02-w-uzyciu",
  context: "03-zastosowanie",
  detail: "04-detal",
  scale: "05-skala",
  packshot: "06-packshot-biale-tlo",
};

export interface ImageJob {
  /** null = packshot na białym tle, wspólny dla wszystkich serii (i główne zdjęcie na Allegro). */
  series: number | null;
  kind: ImageKind;
  prompt: string;
  aspectRatio: AspectRatio;
}

export interface GeneratedImage extends ImageJob {
  fileName: string;
  data: Buffer;
}

export interface ImageFailure extends ImageJob {
  error: string;
}

const PRESERVE_RULES =
  "Keep the product identical to the reference photo: same shape, proportions, colors, materials, logos, labels, buttons and ports. " +
  "Do not redesign, add or remove any part of the product. Do not add any text, captions, watermarks or extra logos to the image. " +
  "Use the reference photo only for the product itself: do not reuse its background, room, furniture or other objects. " +
  "Prefer camera angles that show the same sides of the product as the reference photo. If a side that is not visible in the reference " +
  "has to be shown, keep it plain and simple - never invent ports, buttons, labels or logos on it.";

const STYLE =
  "Style: photorealistic commercial product photograph, full-frame camera, natural soft light, realistic shadows and reflections, " +
  "sharp focus on the product, high detail, clean composition, the product clearly visible and recognisable. " +
  "The scene must be physically plausible: e.g. a projector's lens points at the image it projects, so show it from the side.";

const PACKSHOT_SCENE =
  "The product alone on a pure white (#FFFFFF) seamless studio background, centered, filling about 80% of the frame, " +
  "front three-quarter view, soft natural shadow under the product, no props.";

const SAFE_SCENE = "The product standing on a tidy light wooden table in a bright, modern, minimalist interior, daylight.";

export function buildPrompt(productDescription: string, scene: string): string {
  return [
    "Create a photorealistic product photo using the product from the reference photo.",
    `PRODUCT: ${productDescription}`,
    PRESERVE_RULES,
    `SCENE: ${scene}`,
    STYLE,
  ].join("\n\n");
}

export function planImageJobs(plan: ImagePlan): ImageJob[] {
  const jobs: ImageJob[] = [
    { series: null, kind: "packshot", prompt: buildPrompt(plan.productDescription, PACKSHOT_SCENE), aspectRatio: "1:1" },
  ];
  plan.series.forEach((s, i) => {
    for (const shot of s.shots) {
      jobs.push({ series: i + 1, kind: shot.kind, prompt: buildPrompt(plan.productDescription, shot.scene), aspectRatio: "4:3" });
    }
  });
  return jobs;
}

export async function prepareReference(photo: Buffer): Promise<{ data: Buffer; mimeType: string }> {
  const data = await sharp(photo).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { data, mimeType: "image/jpeg" };
}

/** JPEG do 1600 px, bez metadanych; packshot dostaje twarde białe tło. */
export async function finalizeImage(data: Buffer, kind: ImageKind): Promise<Buffer> {
  let img = sharp(data).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
  if (kind === "packshot") img = img.flatten({ background: "#ffffff" });
  return img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export interface GenerateImagesOptions {
  apiKey: string;
  model: string;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Do testów – podmiana wywołania API. */
  generate?: typeof generateGeminiImage;
  retryDelaysMs?: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runJob(
  job: ImageJob,
  references: { data: Buffer; mimeType: string }[],
  productDescription: string,
  opts: GenerateImagesOptions,
): Promise<Buffer> {
  const generate = opts.generate ?? generateGeminiImage;
  const delays = opts.retryDelaysMs ?? [3000, 8000];
  let prompt = job.prompt;
  let usedSafePrompt = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = await generate({ apiKey: opts.apiKey, model: opts.model, prompt, references, aspectRatio: job.aspectRatio, signal: opts.signal });
      return await finalizeImage(raw, job.kind);
    } catch (err) {
      const retryable = err instanceof ImageGenerationError ? err.retryable : true;
      if (!retryable && !usedSafePrompt && job.kind !== "packshot") {
        // Np. filtr bezpieczeństwa na konkretnej scenie – jedna próba z neutralną sceną.
        usedSafePrompt = true;
        prompt = buildPrompt(productDescription, SAFE_SCENE);
        continue;
      }
      if (!retryable || attempt >= delays.length) throw err;
      await sleep(delays[attempt]!);
    }
  }
}

export async function generateImageSeries(
  photos: Buffer[],
  plan: ImagePlan,
  opts: GenerateImagesOptions,
): Promise<{ images: GeneratedImage[]; failures: ImageFailure[] }> {
  if (photos.length === 0) throw new Error("Do wygenerowania zdjęć potrzebne jest przynajmniej jedno zdjęcie produktu.");
  const references = await Promise.all(photos.slice(0, 3).map(prepareReference));
  const jobs = planImageJobs(plan);
  const images: GeneratedImage[] = [];
  const failures: ImageFailure[] = [];
  let done = 0;
  let next = 0;

  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      try {
        const data = await runJob(job, references, plan.productDescription, opts);
        images.push({ ...job, fileName: `${SHOT_FILE_NAMES[job.kind]}.jpg`, data });
      } catch (err) {
        failures.push({ ...job, error: (err as Error).message });
      }
      opts.onProgress?.(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, jobs.length) }, worker));

  const rank = (i: { series: number | null; kind: ImageKind }) => (i.series ?? 0) * 10 + Object.keys(SHOT_FILE_NAMES).indexOf(i.kind);
  images.sort((a, b) => rank(a) - rank(b));
  return { images, failures };
}
