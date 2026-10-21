import JSZip from "jszip";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { loadTemplates, renderListings } from "../src/copy/listing";
import { DEMO_COPY } from "../src/demo";
import { ImageGenerationError } from "../src/images/gemini";
import { generateImageSeries, planImageJobs } from "../src/images/series";
import { buildOfferZip, seriesImages } from "../src/pack/zip";

const photo = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#3366aa" } }).png().toBuffer();
const fakeImage = () => sharp({ create: { width: 1024, height: 768, channels: 4, background: { r: 10, g: 200, b: 10, alpha: 0.5 } } }).png().toBuffer();

describe("planImageJobs", () => {
  it("1 packshot + 5 ujęć na serię", () => {
    const jobs = planImageJobs(DEMO_COPY.imagePlan);
    expect(jobs).toHaveLength(11);
    expect(jobs[0]).toMatchObject({ series: null, kind: "packshot", aspectRatio: "1:1" });
    expect(jobs.filter((j) => j.series === 2).map((j) => j.kind)).toEqual(["hero", "in_use", "context", "detail", "scale"]);
    expect(jobs[1]!.prompt).toContain("Keep the product identical");
  });
});

describe("generateImageSeries", () => {
  it("generuje, ponawia i używa bezpiecznej sceny po blokadzie", async () => {
    const calls: string[] = [];
    let failedOnce = false;
    const { images, failures } = await generateImageSeries([await photo()], DEMO_COPY.imagePlan, {
      apiKey: "x",
      model: "test",
      retryDelaysMs: [1, 1],
      generate: async (req) => {
        calls.push(req.prompt);
        if (req.prompt.includes("starry night") && !failedOnce) {
          failedOnce = true;
          throw new ImageGenerationError("blocked", false);
        }
        if (req.prompt.includes("garden table")) throw new ImageGenerationError("HTTP 500", true);
        return fakeImage();
      },
    });
    expect(images).toHaveLength(10);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ series: 2, kind: "context" });
    expect(calls.some((c) => c.includes("tidy light wooden table"))).toBe(true);
    const packshot = images.find((i) => i.kind === "packshot")!;
    const meta = await sharp(packshot.data).metadata();
    expect(meta.format).toBe("jpeg");
    expect(seriesImages(images, 1).map((i) => i.fileName)).toEqual([
      "01-okladka.jpg",
      "02-w-uzyciu.jpg",
      "03-zastosowanie.jpg",
      "04-detal.jpg",
      "05-skala.jpg",
      "06-packshot-biale-tlo.jpg",
    ]);
  });
});

describe("buildOfferZip", () => {
  it("układa foldery olx/allegro/revion", async () => {
    const templates = loadTemplates(path.resolve(import.meta.dirname, "../../../config/szablony"));
    const listings = renderListings(DEMO_COPY, { seriesCount: 2, delivery: { min: 2, max: 4 }, competitorKeywords: true }, templates);
    const { images } = await generateImageSeries([await photo()], DEMO_COPY.imagePlan, {
      apiKey: "x",
      model: "test",
      generate: async () => fakeImage(),
    });
    const buf = await buildOfferZip({ slug: "projektor", copy: DEMO_COPY, listings, images, failures: [], meta: {}, warnings: ["test"] });
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).filter((n) => !n.endsWith("/"));
    expect(names).toContain("projektor/CZYTAJ.txt");
    expect(names).toContain("projektor/olx/seria-1-salon-wieczorem/opis.txt");
    expect(names).toContain("projektor/olx/seria-2-sypialnia-i-ogrod/06-packshot-biale-tlo.jpg");
    expect(names).toContain("projektor/allegro/01-packshot-biale-tlo.jpg");
    expect(names).toContain("projektor/allegro/opis.html");
    expect(names.filter((n) => n.startsWith("projektor/olx/seria-1") && n.endsWith(".jpg"))).toHaveLength(6);
    const readme = await zip.file("projektor/CZYTAJ.txt")!.async("string");
    expect(readme).toContain("UWAGI");
  });
});
