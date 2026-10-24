import { z } from "zod";

/** Ujęcia jednej serii – wszystkie w tym samym pomieszczeniu (jedno ogłoszenie OLX). */
export const SHOT_KINDS = ["hero", "in_use", "spot", "detail", "wide", "angle"] as const;
export type ShotKind = (typeof SHOT_KINDS)[number];

export const ProductCopySchema = z.object({
  productName: z.string().describe("Pełna, naturalna nazwa produktu"),
  brand: z.string().nullable(),
  olxCategorySuggestion: z.string(),
  olxTitles: z.array(z.string()),
  allegroTitle: z.string(),
  storeTitle: z.string(),
  intro: z.string(),
  benefits: z.array(z.object({ feature: z.string(), benefit: z.string() })),
  specs: z.array(z.object({ name: z.string(), value: z.string() })),
  closing: z.string(),
  setContents: z.array(z.string()),
  keywords: z.array(z.string()),
  competitorKeywords: z.array(z.string()),
  imagePlan: z.object({
    productDescription: z.string(),
    series: z.array(
      z.object({
        theme: z.string(),
        room: z.string(),
        shots: z.array(z.object({ kind: z.enum(SHOT_KINDS), scene: z.string() })),
      }),
    ),
  }),
  warnings: z.array(z.string()),
});

export type ProductCopy = z.infer<typeof ProductCopySchema>;
export type ImagePlan = ProductCopy["imagePlan"];
