import { z } from "zod";

// Plan posta-karuzeli na Instagram i TikTok: slajdy + opisy. Plan pisze Claude w rozmowie, program tylko go rysuje.

/** Instagram i TikTok pozwalają dziś na najwyżej 5 hasztagów w poście. */
export const MAX_HASHTAGS = 5;

const Image = z.string().min(1);

const CoverSlide = z.object({
  type: z.literal("cover"),
  /** Bez zdjęcia: okładka w kolorach marki (poradniki, przedstawienie butiku). */
  image: Image.optional(),
  kicker: z.string().optional(),
  hook: z.string().min(1),
  sub: z.string().optional(),
  chips: z.array(z.string()).max(4).default([]),
});

const PhotoSlide = z.object({
  type: z.literal("photo"),
  image: Image,
  label: z.string().optional(),
});

const InfoSlide = z.object({
  type: z.literal("info"),
  title: z.string().min(1),
  rows: z.array(z.object({ label: z.string(), value: z.string() })).min(1).max(8),
  price: z.string().optional(),
  note: z.string().optional(),
});

const TextSlide = z.object({
  type: z.literal("text"),
  kicker: z.string().optional(),
  title: z.string().min(1),
  points: z.array(z.string()).max(6).default([]),
});

const CtaSlide = z.object({
  type: z.literal("cta"),
  title: z.string().min(1),
  lines: z.array(z.string()).max(4).default([]),
});

export const SlideSchema = z.discriminatedUnion("type", [CoverSlide, PhotoSlide, InfoSlide, TextSlide, CtaSlide]);

/** "#Moda Damska" → "modadamska"; puste i powtórzone wypadają. */
export function normalizeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/^#+/, "").replace(/\s+/g, "").toLocaleLowerCase("pl");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

const Hashtags = z
  .array(z.string())
  .transform(normalizeHashtags)
  .refine((tags) => tags.length <= MAX_HASHTAGS, `Najwyżej ${MAX_HASHTAGS} hasztagów`)
  .refine((tags) => tags.every((t) => /^[\p{L}\p{N}_]+$/u.test(t)), "Hasztag może mieć tylko litery, cyfry i _");

const platform = (maxCaption: number) =>
  z.object({ caption: z.string().min(1).max(maxCaption), hashtags: Hashtags.default([]) });

export const SocialPostSchema = z.object({
  name: z.string().min(1),
  slides: z.array(SlideSchema).min(2).max(20),
  instagram: platform(2200),
  tiktok: platform(4000),
});

export type SocialPost = z.infer<typeof SocialPostSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type SocialPlatform = "instagram" | "tiktok";
