import fs from "node:fs";
import path from "node:path";
import Mustache from "mustache";
import { getConfig } from "../env";
import { dashedPhone, deliveryText } from "../text/format";
import { formatSeriesTitles, formatTitle, type FormattedTitle } from "../text/titles";
import type { ProductCopy } from "./schema";

export interface Templates {
  olx: string;
  allegro: string;
  allegroHtml: string;
  revionHtml: string;
}

export function loadTemplates(dir = path.join(getConfig().configDir, "szablony")): Templates {
  const read = (name: string) => fs.readFileSync(path.join(dir, name), "utf8");
  return {
    olx: read("olx.mustache"),
    allegro: read("allegro.mustache"),
    allegroHtml: read("allegro.html.mustache"),
    revionHtml: read("revion.html.mustache"),
  };
}

export interface ListingOptions {
  seriesCount: number;
  delivery: { min: number; max: number };
  sellerPhone?: string;
  competitorKeywords: boolean;
}

export interface SeriesListing {
  series: number;
  theme: string;
  title: FormattedTitle;
  description: string;
}

export interface ListingTexts {
  olx: SeriesListing[];
  allegro: { title: FormattedTitle; description: string; html: string };
  revion: { title: FormattedTitle; html: string };
  keywordsLine: string;
}

const plain = { escape: (s: string) => s };
const html = {
  escape: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
};

function stripTrailingDot(s: string): string {
  return s.trim().replace(/[.;]+$/, "");
}

export function buildKeywordsLine(copy: ProductCopy, withCompetitors: boolean): string {
  const phrases = [...copy.keywords, ...(withCompetitors ? copy.competitorKeywords : [])];
  const seen = new Set<string>();
  return phrases
    .map((p) => p.toLocaleLowerCase("pl").replace(/\s+/g, " ").trim())
    .filter((p) => p && !seen.has(p) && seen.add(p))
    .join(" ");
}

export function renderListings(copy: ProductCopy, opts: ListingOptions, templates: Templates = loadTemplates()): ListingTexts {
  const delivery = deliveryText(opts.delivery.min, opts.delivery.max);
  const keywordsLine = buildKeywordsLine(copy, opts.competitorKeywords);
  const base = {
    phone: opts.sellerPhone ? true : false,
    phoneDashed: opts.sellerPhone ? dashedPhone(opts.sellerPhone) : "",
    delivery,
    intro: copy.intro.trim(),
    benefits: copy.benefits.map((b) => ({ feature: stripTrailingDot(b.feature), benefit: stripTrailingDot(b.benefit) })),
    specs: copy.specs.map((s) => ({ name: s.name.trim().replace(/:$/, ""), value: s.value.trim() })),
    closing: copy.closing.trim(),
    setContents: (copy.setContents.length ? copy.setContents : [copy.productName]).map((item, i) => ({ index: i + 1, item: item.trim() })),
  };
  const view = (title: string, extra: Record<string, unknown> = {}) => ({
    ...base,
    title,
    titleUpper: title.toLocaleUpperCase("pl"),
    ...extra,
  });

  // Gdy model da za mało unikalnych wariantów, dobieramy z tytułu Allegro i nazwy sklepowej.
  const olxTitles = formatSeriesTitles(
    [...copy.olxTitles, copy.allegroTitle, copy.storeTitle, copy.productName],
    opts.seriesCount,
    "olx",
  );
  const olx = Array.from({ length: opts.seriesCount }, (_, i) => {
    const title = olxTitles[i] ?? olxTitles[0] ?? formatTitle(copy.productName, "olx");
    return {
      series: i + 1,
      theme: copy.imagePlan.series[i]?.theme ?? `Seria ${i + 1}`,
      title,
      description: tidy(Mustache.render(templates.olx, view(title.title, { keywordsLine }), {}, plain)),
    };
  });

  const allegroTitle = formatTitle(copy.allegroTitle || copy.olxTitles[0] || copy.productName, "allegro");
  const revionTitle = formatTitle(copy.storeTitle || copy.productName, "revion");

  return {
    olx,
    allegro: {
      title: allegroTitle,
      description: tidy(Mustache.render(templates.allegro, view(allegroTitle.title), {}, plain)),
      html: tidy(Mustache.render(templates.allegroHtml, view(allegroTitle.title), {}, html)),
    },
    revion: {
      title: revionTitle,
      html: tidy(Mustache.render(templates.revionHtml, view(revionTitle.title), {}, html)),
    },
    keywordsLine,
  };
}

/** Maksymalnie jedna pusta linia z rzędu, bez spacji na końcach linii. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
