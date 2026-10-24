import JSZip from "jszip";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { loadTemplates, renderListings } from "../src/copy/listing";
import { normalizeImagePlan } from "../src/copy/copywriter";
import { DEMO_COPY } from "../src/demo";
import { ImageGenerationError, type GeminiImageRequest } from "../src/images/gemini";
import { buildPrompt, generateImageSeries, planImageJobs } from "../src/images/series";
import { allegroImages, buildOfferZip, seriesImages } from "../src/pack/zip";

const photo = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#3366aa" } }).png().toBuffer();
const fakeImage = () => sharp({ create: { width: 1024, height: 768, channels: 4, background: { r: 10, g: 200, b: 10, alpha: 0.5 } } }).png().toBuffer();

const OLX_FILES = [
  "01-okladka.jpg",
  "02-w-uzyciu.jpg",
  "03-inne-miejsce.jpg",
  "04-detal.jpg",
  "05-cale-pomieszczenie.jpg",
  "06-inny-kat.jpg",
];

describe("planImageJobs", () => {
  it("białe tło + 6 ujęć z jednego pomieszczenia na serię", () => {
    const jobs = planImageJobs(DEMO_COPY.imagePlan);
    expect(jobs).toHaveLength(13);
    expect(jobs[0]).toMatchObject({ series: null, kind: "packshot", aspectRatio: "1:1", room: "" });
    const s2 = jobs.filter((j) => j.series === 2);
    expect(s2.map((j) => j.kind)).toEqual(["hero", "in_use", "spot", "detail", "wide", "angle"]);
    expect(new Set(s2.map((j) => j.room)).size).toBe(1);
  });

  it("prompt trzyma produkt i pomieszczenie", () => {
    const job = planImageJobs(DEMO_COPY.imagePlan)[1]!;
    expect(buildPrompt("white projector", job)).toContain("Keep the product identical");
    expect(buildPrompt("white projector", job)).toContain("ROOM (the whole photo series takes place in this one room)");
    expect(buildPrompt("white projector", job, true)).toContain("exactly the same room as in the last reference image");
  });
});

describe("normalizeImagePlan", () => {
  it("dopełnia brakujące serie innymi pomieszczeniami i brakujące ujęcia", () => {
    const short = { ...DEMO_COPY, imagePlan: { ...DEMO_COPY.imagePlan, series: [{ ...DEMO_COPY.imagePlan.series[0]!, shots: [] }] } };
    const plan = normalizeImagePlan(short, 3).imagePlan;
    expect(plan.series).toHaveLength(3);
    expect(new Set(plan.series.map((s) => s.room)).size).toBe(3);
    expect(plan.series.every((s) => s.shots.length === 6)).toBe(true);
    expect(normalizeImagePlan(DEMO_COPY, 1).imagePlan.series).toHaveLength(1);
  });
});

describe("generateImageSeries", () => {
  it("puste pomieszczenie serii jest wzorem dla wszystkich jej ujęć", async () => {
    const calls: GeminiImageRequest[] = [];
    const { images, failures } = await generateImageSeries([await photo()], DEMO_COPY.imagePlan, {
      apiKey: "x",
      model: "test",
      generate: async (req) => {
        calls.push(req);
        return fakeImage();
      },
    });
    expect(failures).toHaveLength(0);
    expect(images).toHaveLength(13);
    expect(calls).toHaveLength(15);
    const roomCalls = calls.filter((c) => c.prompt.includes("interior photograph of an empty room"));
    expect(roomCalls).toHaveLength(2);
    expect(roomCalls.every((c) => c.references.length === 0)).toBe(true);
    const shots = calls.filter((c) => c.prompt.includes("SHOT:") && !c.prompt.includes("pure white"));
    expect(shots).toHaveLength(12);
    expect(shots.every((c) => c.references.length === 2 && c.prompt.includes("Do not copy the camera position"))).toBe(true);
    expect(seriesImages(images, 1).map((i) => i.fileName)).toEqual(OLX_FILES);
    expect(allegroImages(images).map((i) => i.fileName)).toEqual(["biale-tlo.jpg", ...OLX_FILES]);
    const packshot = await sharp(images.find((i) => i.kind === "packshot")!.data).metadata();
    expect(packshot.format).toBe("jpeg");
  });

  it("ponawia błędy, po blokadzie próbuje neutralnego ujęcia, bez pustego pomieszczenia działa na samym opisie", async () => {
    let blocked = false;
    const calls: GeminiImageRequest[] = [];
    const { images, failures } = await generateImageSeries([await photo()], DEMO_COPY.imagePlan, {
      apiKey: "x",
      model: "test",
      retryDelaysMs: [1, 1],
      generate: async (req) => {
        calls.push(req);
        if (req.prompt.includes("empty room") && req.prompt.includes("cozy modern living room")) throw new ImageGenerationError("HTTP 500", true);
        if (req.prompt.includes("starry night") && !blocked) {
          blocked = true;
          throw new ImageGenerationError("blocked", false);
        }
        if (req.prompt.includes("macro close-up")) throw new ImageGenerationError("HTTP 500", true);
        return fakeImage();
      },
    });
    expect(failures).toEqual([expect.objectContaining({ series: 1, kind: "detail" })]);
    expect(images).toHaveLength(12);
    expect(calls.some((c) => c.prompt.includes("The product standing on a tidy table in this room"))).toBe(true);
    const series1 = calls.filter((c) => c.prompt.includes("SHOT:") && c.prompt.includes("cozy modern living room"));
    expect(series1.length).toBeGreaterThan(0);
    expect(series1.every((c) => c.references.length === 1)).toBe(true);
    const series2 = calls.filter((c) => c.prompt.includes("SHOT:") && c.prompt.includes("Scandinavian bedroom"));
    expect(series2.every((c) => c.references.length === 2)).toBe(true);
  });
});

describe("buildOfferZip", () => {
  it("OLX bez białego tła, Allegro z białym tłem na początku", async () => {
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
    const olx1 = names.filter((n) => n.startsWith("projektor/olx/seria-1-salon-wieczorem/") && n.endsWith(".jpg"));
    expect(olx1.map((n) => n.split("/").pop())).toEqual(OLX_FILES);
    expect(names.some((n) => n.includes("/olx/") && n.includes("biale-tlo"))).toBe(false);
    expect(names).toContain("projektor/olx/seria-2-sypialnia-rano/opis.txt");
    expect(names).toContain("projektor/allegro/01-biale-tlo.jpg");
    expect(names).toContain("projektor/allegro/02-okladka.jpg");
    expect(names).toContain("projektor/allegro/opis.html");
    const readme = await zip.file("projektor/CZYTAJ.txt")!.async("string");
    expect(readme).toContain("UWAGI");
  });
});
