import { generateGeminiImage, ImageGenerationError } from "../images/gemini";
import { finalizeImage, prepareReference, type GenerateImagesOptions } from "../images/series";

// Zdjęcia ubrań na Vinted/Szafę: rzecz na manekinie i na modelu, na tle użytkownika (albo domyślnym).
// Prawdziwe zdjęcia rzeczy zostają w ogłoszeniu – te są dodatkiem oznaczonym jako wizualizacja AI.

export type VintedItemType = "ubranie" | "buty";

export interface VintedShot {
  file: string;
  scene: string;
  withModel: boolean;
}

export const VINTED_SHOTS: Record<VintedItemType, VintedShot[]> = {
  ubranie: [
    {
      file: "1-manekin",
      scene:
        "The garment on a plain matte white tailor's mannequin standing in the room (upper-body dress form for tops, jackets and dresses, " +
        "lower-body mannequin for trousers and skirts), front view, the whole garment visible and centered.",
      withModel: false,
    },
    {
      file: "2-model",
      scene:
        "Full-length shot: the model wears the garment, standing in the room at a slight three-quarter angle, framed from the nose down to the feet, " +
        "the whole garment clearly visible. " +
        "The rest of the outfit is simple and in neutral colors, so the garment stands out.",
      withModel: true,
    },
    {
      file: "3-model-blisko",
      scene:
        "Close-up: the camera is close to the model, framed from the shoulders to the hips (for trousers and skirts: from the waist to the knees), " +
        "the garment fills most of the frame, showing the fabric texture, fastenings and how it fits.",
      withModel: true,
    },
  ],
  buty: [
    {
      file: "1-para",
      scene: "The pair of shoes standing on the floor of the room, one shoe from the side and one at a three-quarter front angle, low camera at floor level.",
      withModel: false,
    },
    {
      file: "2-na-nogach",
      scene: "The model wearing the shoes, walking in the room, framed from the knees down, side view, the shoes in sharp focus.",
      withModel: true,
    },
    {
      file: "3-blisko",
      scene: "Close-up of the model's feet in the shoes, three-quarter front view, low camera, the shoes in sharp focus.",
      withModel: true,
    },
  ],
};

const PRESERVE_RULES =
  "Keep the item 100% identical to the item reference photo(s): color and shade, pattern, print, logo (position, size, text), stitching, " +
  "buttons, zippers, pockets, laces, soles, length, cut and fit. Do not add, remove or change any logos, text or details. " +
  "Keep any visible wear, creases or fading – do not make it look newer. Use the reference photo(s) only for the item itself: " +
  "ignore the tape measure, hanger, hands, bed, floor and anything else around it.";

const BACKGROUND_FROM_REFERENCE =
  "BACKGROUND: keep the room, wall, floor, furniture and light exactly as in it, " +
  "do not add or remove anything in the room. Match its lighting, perspective and scale, with natural shadows on the floor.";

const DEFAULT_BACKGROUND = "BACKGROUND: bright minimalist room with a warm cream wall and light wooden floor, soft natural daylight.";

const STYLE =
  "Realistic photo taken with a full-frame camera, true-to-life colors, sharp focus on the item, natural soft light. " +
  "No text, captions, watermarks, borders or extra logos. Vertical 3:4 format.";

export interface VintedPromptOptions {
  /** Ile zdjęć rzeczy jest na początku referencji. */
  itemPhotos: number;
  /** Krótki opis rzeczy po angielsku, np. "navy Nike hoodie with white logo, oversize fit". */
  description?: string;
  /** Kto nosi rzecz, np. "adult man, size L, average build". */
  model?: string;
  hasBackground: boolean;
  /** Wcześniejsze zdjęcie z modelem z tego ogłoszenia – ta sama osoba i strój na kolejnych ujęciach. */
  hasModelReference?: boolean;
}

/** Opis kolejności zdjęć referencyjnych: rzecz, (model), (tło). */
function referenceGuide(o: VintedPromptOptions): string {
  const n = o.itemPhotos;
  const lines = [`Reference image${n > 1 ? `s 1-${n} show` : " 1 shows"} the item for sale.`];
  let next = n + 1;
  if (o.hasModelReference) {
    lines.push(`Reference image ${next++} shows the model of this listing: keep the same person, hair, body type and the rest of the outfit.`);
  }
  if (o.hasBackground) lines.push(`Reference image ${next} shows the background room.`);
  return lines.join(" ");
}

export function buildVintedPrompt(shot: VintedShot, o: VintedPromptOptions): string {
  const parts = [
    `Create a realistic photo for a second-hand clothing listing. ${referenceGuide(o)}`,
    o.description ? `ITEM: ${o.description}` : "ITEM: the clothing item shown in the reference photo(s).",
    PRESERVE_RULES,
    o.hasBackground ? BACKGROUND_FROM_REFERENCE : DEFAULT_BACKGROUND,
    `SHOT: ${shot.scene}`,
  ];
  if (shot.withModel) {
    parts.push(
      `MODEL: realistic ${o.model ?? "adult model whose gender and build suit the item"}, natural relaxed pose, ` +
        "face cropped at the nose or turned away from the camera, natural skin texture, no celebrity likeness.",
    );
  }
  parts.push(STYLE);
  return parts.join("\n\n");
}

export interface VintedPhotoInput {
  /** Zdjęcia rzeczy – pierwsze: cała rzecz, najlepiej bez metra. */
  photos: Buffer[];
  background?: Buffer;
  type: VintedItemType;
  description?: string;
  model?: string;
  /** Numery ujęć do zrobienia (1–3); puste = wszystkie. */
  only?: number[];
  /** Gotowe zdjęcie z modelem z tego ogłoszenia (przy poprawianiu samego ujęcia 3 – ta sama osoba). */
  modelReference?: Buffer;
}

export interface VintedImage {
  file: string;
  data: Buffer;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateVintedPhotos(
  input: VintedPhotoInput,
  opts: GenerateImagesOptions,
): Promise<{ images: VintedImage[]; failures: { file: string; error: string }[] }> {
  if (input.photos.length === 0) throw new Error("Potrzebne jest przynajmniej jedno zdjęcie rzeczy.");
  const itemRefs = await Promise.all(input.photos.slice(0, 3).map(prepareReference));
  const background = input.background ? await prepareReference(input.background) : undefined;
  const shots = VINTED_SHOTS[input.type].filter((_, i) => !input.only?.length || input.only.includes(i + 1));
  const generate = opts.generate ?? generateGeminiImage;
  const delays = opts.retryDelaysMs ?? [3000, 8000];

  const images: VintedImage[] = [];
  const failures: { file: string; error: string }[] = [];
  let done = 0;
  const run = async (shot: VintedShot, modelRef?: Buffer): Promise<Buffer | undefined> => {
    const modelReference = modelRef ? await prepareReference(modelRef) : undefined;
    const references = [...itemRefs, ...(modelReference ? [modelReference] : []), ...(background ? [background] : [])];
    const prompt = buildVintedPrompt(shot, {
      itemPhotos: itemRefs.length,
      description: input.description,
      model: input.model,
      hasBackground: !!background,
      hasModelReference: !!modelReference,
    });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const raw = await generate({ apiKey: opts.apiKey, model: opts.model, prompt, references, aspectRatio: "3:4", signal: opts.signal });
          const data = await finalizeImage(raw, "hero");
          images.push({ file: `${shot.file}.jpg`, data });
          return data;
        } catch (err) {
          const retryable = err instanceof ImageGenerationError ? err.retryable : true;
          if (!retryable || attempt >= delays.length) {
            failures.push({ file: `${shot.file}.jpg`, error: (err as Error).message });
            return undefined;
          }
          await sleep(delays[attempt]!);
        }
      }
    } finally {
      opts.onProgress?.(++done, shots.length);
    }
  };

  // Ujęcia bez modela lecą od razu; ujęcia z modelem po kolei – pierwsze jest wzorem osoby i stroju dla następnych.
  const modelShots = shots.filter((s) => s.withModel);
  await Promise.all([
    ...shots.filter((s) => !s.withModel).map((s) => run(s)),
    (async () => {
      let modelRef = input.modelReference;
      for (const s of modelShots) modelRef = (await run(s, modelRef)) ?? modelRef;
    })(),
  ]);
  images.sort((a, b) => a.file.localeCompare(b.file));
  return { images, failures };
}
