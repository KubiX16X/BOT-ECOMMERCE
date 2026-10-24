import sharp from "sharp";
import type { ImagePlan, ShotKind } from "../copy/schema";
import { generateGeminiImage, ImageGenerationError, type AspectRatio } from "./gemini";

export type ImageKind = ShotKind | "packshot";

export const SHOT_FILE_NAMES: Record<ImageKind, string> = {
  hero: "01-okladka",
  in_use: "02-w-uzyciu",
  spot: "03-inne-miejsce",
  detail: "04-detal",
  wide: "05-cale-pomieszczenie",
  angle: "06-inny-kat",
  packshot: "biale-tlo",
};

const KIND_ORDER = Object.keys(SHOT_FILE_NAMES) as ImageKind[];

export interface ImageJob {
  /** null = zdjęcie na białym tle (tylko Allegro). */
  series: number | null;
  kind: ImageKind;
  /** Opis pomieszczenia serii (puste dla białego tła). */
  room: string;
  scene: string;
  aspectRatio: AspectRatio;
}

export interface GeneratedImage extends ImageJob {
  fileName: string;
  data: Buffer;
}

export interface ImageFailure extends ImageJob {
  error: string;
}

type Reference = { data: Buffer; mimeType: string };

const PRESERVE_RULES =
  "Keep the product identical to the product reference photo: same shape, proportions, colors, materials, logos, labels, buttons and ports. " +
  "Do not redesign, add or remove any part of the product. Do not add any text, captions, watermarks or extra logos to the image. " +
  "Use the product reference photo only for the product itself: do not reuse its background, room, furniture or other objects. " +
  "Prefer camera angles that show the same sides of the product as the reference photo. If a side that is not visible in the reference " +
  "has to be shown, keep it plain and simple - never invent ports, buttons, labels or logos on it.";

const STYLE =
  "Style: photorealistic commercial product photograph, full-frame camera, natural soft light, realistic shadows and reflections, " +
  "sharp focus on the product, high detail, clean composition, the product clearly visible and recognisable. " +
  "The scene must be physically plausible: e.g. a projector's lens points at the image it projects. " +
  "Never draw visible light beams, rays or glow coming out of the product.";

const PACKSHOT_SCENE =
  "The product alone on a pure white (#FFFFFF) seamless studio background, centered, filling about 80% of the frame, " +
  "front three-quarter view, soft natural shadow under the product, no props.";

const SAFE_SCENE = "The product standing on a tidy table in this room, eye-level camera, daylight.";

export function buildPrompt(productDescription: string, job: Pick<ImageJob, "room" | "scene">, sameRoomAsReference = false): string {
  const parts = [
    sameRoomAsReference
      ? "Create a photorealistic product photo. The FIRST reference image(s) show the product. The LAST reference image shows the EMPTY room of this photo series (without the product)."
      : "Create a photorealistic product photo using the product from the reference photo.",
    `PRODUCT: ${productDescription}`,
    PRESERVE_RULES,
  ];
  if (job.room) {
    parts.push(
      sameRoomAsReference
        ? `ROOM: Place the product in exactly the same room as in the last reference image – same walls, floor, furniture, decorations, windows, light and time of day. ` +
            `Do not copy the camera position of the room image: use the camera position, distance and framing from SHOT. Room description: ${job.room}`
        : `ROOM (the whole photo series takes place in this one room): ${job.room}`,
    );
  }
  parts.push(`SHOT: ${job.scene}`, STYLE);
  return parts.join("\n\n");
}

/** Zdjęcie pustego pomieszczenia – wspólny wzór dla wszystkich ujęć serii (nie trafia do paczki). */
export function buildRoomPrompt(room: string): string {
  return [
    "Create a photorealistic interior photograph of an empty room: no people, no electronic devices on the furniture, no text.",
    `ROOM: ${room}`,
    "Wide-angle shot from a corner of the room at eye level, showing most of the room and its furniture. Natural, realistic light as described.",
  ].join("\n\n");
}

export function planImageJobs(plan: ImagePlan): ImageJob[] {
  const jobs: ImageJob[] = [{ series: null, kind: "packshot", room: "", scene: PACKSHOT_SCENE, aspectRatio: "1:1" }];
  plan.series.forEach((s, i) => {
    for (const shot of s.shots) jobs.push({ series: i + 1, kind: shot.kind, room: s.room, scene: shot.scene, aspectRatio: "4:3" });
  });
  return jobs;
}

export async function prepareReference(photo: Buffer): Promise<Reference> {
  const data = await sharp(photo).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  return { data, mimeType: "image/jpeg" };
}

/** JPEG do 1600 px, bez metadanych; zdjęcie na białym tle dostaje twarde białe tło. */
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
  references: Reference[],
  productDescription: string,
  sameRoomAsReference: boolean,
  opts: GenerateImagesOptions,
): Promise<Buffer> {
  const generate = opts.generate ?? generateGeminiImage;
  const delays = opts.retryDelaysMs ?? [3000, 8000];
  let prompt = buildPrompt(productDescription, job, sameRoomAsReference);
  let usedSafePrompt = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const raw = await generate({ apiKey: opts.apiKey, model: opts.model, prompt, references, aspectRatio: job.aspectRatio, signal: opts.signal });
      return await finalizeImage(raw, job.kind);
    } catch (err) {
      const retryable = err instanceof ImageGenerationError ? err.retryable : true;
      if (!retryable && !usedSafePrompt && job.kind !== "packshot") {
        // Np. filtr bezpieczeństwa na konkretnej scenie – jedna próba z neutralnym ujęciem w tym samym pomieszczeniu.
        usedSafePrompt = true;
        prompt = buildPrompt(productDescription, { room: job.room, scene: SAFE_SCENE }, sameRoomAsReference);
        continue;
      }
      if (!retryable || attempt >= delays.length) throw err;
      await sleep(delays[attempt]!);
    }
  }
}

/**
 * Najpierw białe tło i zdjęcie pustego pomieszczenia każdej serii, potem wszystkie ujęcia –
 * każde z pustym pomieszczeniem swojej serii jako ostatnim zdjęciem referencyjnym, żeby całe
 * ogłoszenie działo się w tym samym miejscu, ale z różnych pozycji kamery.
 */
export async function generateImageSeries(
  photos: Buffer[],
  plan: ImagePlan,
  opts: GenerateImagesOptions,
): Promise<{ images: GeneratedImage[]; failures: ImageFailure[] }> {
  if (photos.length === 0) throw new Error("Do wygenerowania zdjęć potrzebne jest przynajmniej jedno zdjęcie produktu.");
  const productRefs = await Promise.all(photos.slice(0, 3).map(prepareReference));
  const jobs = planImageJobs(plan);
  const images: GeneratedImage[] = [];
  const failures: ImageFailure[] = [];
  const total = jobs.length + plan.series.length;
  let done = 0;

  const runPool = async (batch: ImageJob[], refsFor: (job: ImageJob) => { refs: Reference[]; sameRoom: boolean }) => {
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const job = batch[next++]!;
        const { refs, sameRoom } = refsFor(job);
        try {
          const data = await runJob(job, refs, plan.productDescription, sameRoom, opts);
          images.push({ ...job, fileName: `${SHOT_FILE_NAMES[job.kind]}.jpg`, data });
        } catch (err) {
          failures.push({ ...job, error: (err as Error).message });
        }
        opts.onProgress?.(++done, total);
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, batch.length) }, worker));
  };

  // Puste pomieszczenia generujemy równolegle z białym tłem. Gdy się nie uda, seria leci tylko na opisie pomieszczenia.
  const roomRefs = new Map<number, Reference>();
  const generate = opts.generate ?? generateGeminiImage;
  const rooms = plan.series.map(async (s, i) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await generate({ apiKey: opts.apiKey, model: opts.model, prompt: buildRoomPrompt(s.room), references: [], aspectRatio: "4:3", signal: opts.signal });
        roomRefs.set(i + 1, await prepareReference(raw));
        break;
      } catch {
        // druga próba albo seria bez wzoru pomieszczenia
      }
    }
    opts.onProgress?.(++done, total);
  });
  await Promise.all([
    ...rooms,
    runPool(
      jobs.filter((j) => j.kind === "packshot"),
      () => ({ refs: productRefs, sameRoom: false }),
    ),
  ]);

  await runPool(
    jobs.filter((j) => j.kind !== "packshot"),
    (job) => {
      const room = roomRefs.get(job.series!);
      return room ? { refs: [...productRefs, room], sameRoom: true } : { refs: productRefs, sameRoom: false };
    },
  );

  const rank = (i: { series: number | null; kind: ImageKind }) => (i.series ?? 0) * 10 + KIND_ORDER.indexOf(i.kind);
  images.sort((a, b) => rank(a) - rank(b));
  return { images, failures };
}
