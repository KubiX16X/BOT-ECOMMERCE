import { randomUUID } from "node:crypto";
import {
  generateOffer,
  savePack,
  type GenerateOptions,
  type GeneratorInput,
  type GeneratorProgress,
  type ImageKind,
  type ListingTexts,
  type OfferPack,
} from "@revion/core";

// Zadania generowania trzymamy w pamięci serwera (panel działa jako stały proces `next start`).
// Gotowe paczki i tak lądują na dysku w DATA_DIR/paczki.

export interface Job {
  id: string;
  status: "running" | "done" | "error";
  progress: GeneratorProgress;
  startedAt: number;
  pack?: OfferPack;
  error?: string;
}

export interface JobImage {
  name: string;
  url: string;
  series: number | null;
  kind: ImageKind;
}

export interface JobView {
  id: string;
  status: Job["status"];
  progress: GeneratorProgress;
  error?: string;
  result?: {
    productName: string;
    olxCategorySuggestion: string;
    listings: ListingTexts;
    warnings: string[];
    images: JobImage[];
    failures: { series: number | null; kind: ImageKind; error: string }[];
  };
}

const store = globalThis as unknown as { __revionJobs?: Map<string, Job> };
const jobs = (store.__revionJobs ??= new Map<string, Job>());
const MAX_JOBS = 20;

export function imageName(series: number | null, kind: ImageKind): string {
  return `${series ?? "p"}-${kind}`;
}

export function startJob(input: GeneratorInput, opts: Pick<GenerateOptions, "skipImages" | "copy"> = {}): Job {
  const job: Job = { id: randomUUID(), status: "running", progress: { stage: "copy", message: "Start…" }, startedAt: Date.now() };
  jobs.set(job.id, job);
  for (const old of [...jobs.values()].sort((a, b) => a.startedAt - b.startedAt).slice(0, Math.max(0, jobs.size - MAX_JOBS))) {
    if (old.status !== "running") jobs.delete(old.id);
  }

  generateOffer(input, { ...opts, onProgress: (p) => (job.progress = p) })
    .then((pack) => {
      job.pack = pack;
      job.status = "done";
      job.progress = { stage: "pack", message: "Gotowe" };
      savePack(pack);
    })
    .catch((err: Error) => {
      console.error("Generator:", err);
      job.status = "error";
      job.error = err.message;
    });
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function jobView(job: Job): JobView {
  const view: JobView = { id: job.id, status: job.status, progress: job.progress, error: job.error };
  const pack = job.pack;
  if (pack) {
    view.result = {
      productName: pack.copy.productName,
      olxCategorySuggestion: pack.copy.olxCategorySuggestion,
      listings: pack.listings,
      warnings: pack.warnings,
      images: pack.images.map((img) => {
        const name = imageName(img.series, img.kind);
        return { name, url: `/api/admin/generator/${job.id}/img/${name}`, series: img.series, kind: img.kind };
      }),
      failures: pack.failures.map((f) => ({ series: f.series, kind: f.kind, error: f.error })),
    };
  }
  return view;
}
