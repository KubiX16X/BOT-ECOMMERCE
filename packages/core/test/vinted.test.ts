import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageGenerationError, type GeminiImageRequest } from "../src/images/gemini";
import { buildVintedPrompt, generateVintedPhotos, VINTED_SHOTS } from "../src/vinted/photos";

const photo = (color: string) => sharp({ create: { width: 600, height: 800, channels: 3, background: color } }).png().toBuffer();
const fakeImage = () => sharp({ create: { width: 768, height: 1024, channels: 3, background: "#888888" } }).png().toBuffer();

describe("buildVintedPrompt", () => {
  it("trzyma rzecz i tło z ostatniego zdjęcia", () => {
    const p = buildVintedPrompt(VINTED_SHOTS.ubranie[1]!, {
      itemPhotos: 2,
      description: "navy hoodie",
      model: "adult man, size L",
      hasBackground: true,
      hasModelReference: true,
    });
    expect(p).toContain("ITEM: navy hoodie");
    expect(p).toContain("Keep the item 100% identical");
    expect(p).toContain("Reference images 1-2 show the item for sale.");
    expect(p).toContain("Reference image 3 shows the model of this listing");
    expect(p).toContain("Reference image 4 shows the background room.");
    expect(p).toContain("MODEL: realistic adult man, size L");
  });

  it("bez tła – domyślne pomieszczenie; manekin bez modela", () => {
    const p = buildVintedPrompt(VINTED_SHOTS.ubranie[0]!, { itemPhotos: 1, hasBackground: false });
    expect(p).toContain("warm cream wall");
    expect(p).not.toContain("MODEL:");
  });
});

describe("generateVintedPhotos", () => {
  it("3 zdjęcia 3:4, tło jako ostatnia referencja, modelka z ujęcia 2 jako wzór dla 3", async () => {
    const calls: GeminiImageRequest[] = [];
    const generate = async (req: GeminiImageRequest) => {
      calls.push(req);
      return fakeImage();
    };
    const { images, failures } = await generateVintedPhotos(
      { photos: [await photo("#223366")], background: await photo("#eeddcc"), type: "ubranie" },
      { apiKey: "k", model: "m", generate },
    );
    expect(failures).toEqual([]);
    expect(images.map((i) => i.file)).toEqual(["1-manekin.jpg", "2-model.jpg", "3-model-blisko.jpg"]);
    expect(calls.every((c) => c.aspectRatio === "3:4")).toBe(true);
    const byShot = (text: string) => calls.find((c) => c.prompt.includes(text))!;
    expect(byShot("tailor's mannequin").references).toHaveLength(2);
    expect(byShot("Full-length shot").references).toHaveLength(2);
    expect(byShot("Close-up").references).toHaveLength(3);
    const lastRef = await sharp(byShot("Close-up").references.at(-1)!.data).stats();
    expect(Math.round(lastRef.channels[0]!.mean)).toBeGreaterThan(200);
  });

  it("poprawka samego ujęcia 3 dostaje gotowe zdjęcie z modelem", async () => {
    const calls: GeminiImageRequest[] = [];
    const generate = async (req: GeminiImageRequest) => {
      calls.push(req);
      return fakeImage();
    };
    const { images } = await generateVintedPhotos(
      { photos: [await photo("#223366")], type: "ubranie", only: [3], modelReference: await fakeImage() },
      { apiKey: "k", model: "m", generate },
    );
    expect(images.map((i) => i.file)).toEqual(["3-model-blisko.jpg"]);
    expect(calls[0]!.references).toHaveLength(2);
    expect(calls[0]!.prompt).toContain("Reference image 2 shows the model of this listing");
  });

  it("--tylko robi wybrane ujęcia, błąd bez ponowień trafia do failures", async () => {
    const generate = async () => {
      throw new ImageGenerationError("blokada", false);
    };
    const { images, failures } = await generateVintedPhotos(
      { photos: [await photo("#000000")], type: "buty", only: [2] },
      { apiKey: "k", model: "m", generate },
    );
    expect(images).toEqual([]);
    expect(failures.map((f) => f.file)).toEqual(["2-na-nogach.jpg"]);
  });
});
