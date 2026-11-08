import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import sharp from "sharp";
import { getConfig } from "../env";
import type { SocialPlatform, SocialPost } from "./schema";
import { captionText, SLIDE_SIZES, slideHtml } from "./slides";

// Rysuje slajdy w Chromium (Playwright jest preinstalowany w środowisku Claude) i pakuje je z opisami do ZIP-a.

interface Page {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, options?: { waitUntil?: "load" | "networkidle" }): Promise<unknown>;
  evaluate(script: string): Promise<unknown>;
  screenshot(options: { path: string; type: "jpeg"; quality: number }): Promise<Buffer>;
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

function chromium(): { launch(): Promise<Browser> } {
  try {
    return createRequire(import.meta.url)("playwright").chromium;
  } catch {
    throw new Error("Brak Playwright z przeglądarką Chromium – posty da się rysować tylko w środowisku, które go ma.");
  }
}

export const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

export interface RenderOptions {
  /** Katalog, względem którego liczone są ścieżki zdjęć z planu. */
  baseDir: string;
  outDir: string;
  handle?: string;
}

export interface RenderResult {
  dir: string;
  zipPath: string;
  preview: string;
  files: Record<SocialPlatform, string[]>;
}

export async function renderSocialPost(post: SocialPost, opts: RenderOptions): Promise<RenderResult> {
  const config = getConfig();
  const resolveImage = (image: string) => {
    const file = path.resolve(opts.baseDir, image);
    if (!fs.existsSync(file)) throw new Error(`Nie ma zdjęcia: ${image}`);
    return file;
  };
  for (const s of post.slides) if ("image" in s && s.image) resolveImage(s.image);

  const asset = (...p: string[]) => pathToFileURL(path.join(config.configDir, ...p)).href;
  fs.mkdirSync(opts.outDir, { recursive: true });
  const tmp = path.join(opts.outDir, "_slajd.html");
  const files = { instagram: [], tiktok: [] } as Record<SocialPlatform, string[]>;

  const browser = await chromium().launch();
  try {
    const page = await browser.newPage();
    for (const platform of PLATFORMS) {
      const { width, height } = SLIDE_SIZES[platform];
      await page.setViewportSize({ width, height });
      fs.mkdirSync(path.join(opts.outDir, platform), { recursive: true });
      for (const [index, slide] of post.slides.entries()) {
        fs.writeFileSync(
          tmp,
          slideHtml(slide, {
            platform,
            index,
            total: post.slides.length,
            handle: opts.handle ?? "@prawienowebykuba",
            fontsCss: asset("fonts", "fonts.css"),
            logo: { light: asset("marka", "logo-przezroczyste.svg"), dark: asset("marka", "logo-ciemne.svg"), avatar: asset("marka", "zdjecie-profilowe.svg") },
            imageUrl: (image) => pathToFileURL(resolveImage(image)).href,
          }),
        );
        await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
        await page.evaluate("document.fonts.ready.then(() => window.fit && window.fit())");
        const file = path.join(opts.outDir, platform, `${String(index + 1).padStart(2, "0")}.jpg`);
        await page.screenshot({ path: file, type: "jpeg", quality: 90 });
        files[platform].push(file);
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(tmp, { force: true });
  }

  for (const platform of PLATFORMS) fs.writeFileSync(path.join(opts.outDir, `opis-${platform}.txt`), captionText(post, platform));
  const preview = path.join(opts.outDir, "podglad.jpg");
  await contactSheet(files.instagram, preview);

  const zip = new JSZip();
  for (const platform of PLATFORMS) {
    for (const f of files[platform]) zip.file(`${platform}/${path.basename(f)}`, fs.readFileSync(f));
    zip.file(`opis-${platform}.txt`, fs.readFileSync(path.join(opts.outDir, `opis-${platform}.txt`)));
  }
  zip.file("podglad.jpg", fs.readFileSync(preview));
  const zipPath = path.join(opts.outDir, `${path.basename(opts.outDir)}.zip`);
  fs.writeFileSync(zipPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return { dir: opts.outDir, zipPath, preview, files };
}

/** Podgląd karuzeli z Instagrama: miniatury w rzędach po 5. */
async function contactSheet(slides: string[], out: string): Promise<void> {
  const w = 270, h = 338, gap = 12, cols = Math.min(5, slides.length), rows = Math.ceil(slides.length / cols);
  const tiles = await Promise.all(slides.map((f) => sharp(f).resize(w, h).toBuffer()));
  await sharp({ create: { width: cols * w + (cols + 1) * gap, height: rows * h + (rows + 1) * gap, channels: 3, background: "#1E2B45" } })
    .composite(tiles.map((input, i) => ({ input, left: gap + (i % cols) * (w + gap), top: gap + Math.floor(i / cols) * (h + gap) })))
    .jpeg({ quality: 85 })
    .toFile(out);
}
