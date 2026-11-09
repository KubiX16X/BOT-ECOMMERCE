import type { Slide, SocialPlatform, SocialPost } from "./schema";

// Slajdy jako strony HTML (rysuje je Chromium). Kolory i czcionki marki „Prawie Nowe by Kuba”.

export interface SlideSize {
  width: number;
  height: number;
  /** Margines na przyciski aplikacji: TikTok zasłania dół, prawy bok i zakładki u góry. */
  safeTop: number;
  safeRight: number;
  safeBottom: number;
}

export const SLIDE_SIZES: Record<SocialPlatform, SlideSize> = {
  instagram: { width: 1080, height: 1350, safeTop: 0, safeRight: 0, safeBottom: 0 },
  tiktok: { width: 1080, height: 1440, safeTop: 60, safeRight: 120, safeBottom: 120 },
};

export interface SlideContext {
  platform: SocialPlatform;
  index: number;
  total: number;
  handle: string;
  /** file:// do config/fonts/fonts.css */
  fontsCss: string;
  /** file:// do logo (przezroczyste, ciemne, zdjęcie profilowe) */
  logo: { light: string; dark: string; avatar: string };
  /** Ścieżka zdjęcia → URL file:// */
  imageUrl: (image: string) => string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Opis gotowy do wklejenia: tekst + hasztagi na końcu. */
export function captionText(post: SocialPost, platform: SocialPlatform): string {
  const { caption, hashtags } = post[platform];
  return hashtags.length ? `${caption.trim()}\n\n${hashtags.map((h) => `#${h}`).join(" ")}\n` : `${caption.trim()}\n`;
}

function css(size: SlideSize): string {
  const pad = 72;
  return `
  :root { --ink:#1E2B45; --accent:#C8694A; --accent2:#E39A7B; --cream:#F6EFE6; --quiet:#6B7280; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: ${size.width}px; height: ${size.height}px; overflow: hidden; font-family: 'Jost', sans-serif; color: var(--ink); background: var(--cream); }
  .slide { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .inner { position: absolute; top: ${size.safeTop + pad}px; right: ${size.safeRight + pad}px; bottom: ${size.safeBottom + pad}px; left: ${pad}px; display: flex; flex-direction: column; }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .bg.blur { filter: blur(48px) brightness(.8); transform: scale(1.15); }
  .fg { position: absolute; top: ${size.safeTop}px; left: 0; right: 0; bottom: ${Math.round(size.safeBottom * 0.55)}px; width: 100%; height: calc(100% - ${size.safeTop + Math.round(size.safeBottom * 0.55)}px); object-fit: contain; }
  .shade { position: absolute; left: 0; right: 0; bottom: 0; height: 72%; background: linear-gradient(to bottom, rgba(30,43,69,0), rgba(30,43,69,.55) 45%, rgba(30,43,69,.94)); }
  .pill { display: inline-block; background: var(--accent); color: #fff; font-weight: 600; font-size: 28px; letter-spacing: .28em; text-transform: uppercase; padding: 10px 24px; border-radius: 999px; }
  .counter { position: absolute; top: ${size.safeTop + 40}px; right: ${size.safeRight + 48}px; font-size: 28px; font-weight: 500; letter-spacing: .1em; padding: 8px 18px; border-radius: 999px; background: rgba(246,239,230,.9); color: var(--ink); }
  .brand { position: absolute; top: ${size.safeTop + 36}px; left: 48px; display: flex; align-items: center; gap: 16px; }
  .brand img { width: 88px; height: 88px; }
  .brand span { color: #fff; font-size: 30px; font-weight: 500; letter-spacing: .06em; text-shadow: 0 2px 10px rgba(0,0,0,.45); }
  .hook { font-family: 'Playfair Display', serif; font-weight: 600; line-height: 1.06; }
  .kicker { font-weight: 600; font-size: 30px; letter-spacing: .32em; text-transform: uppercase; color: var(--accent); }
  .chips { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 30px; }
  .chip { background: rgba(246,239,230,.96); color: var(--ink); font-size: 36px; font-weight: 600; padding: 12px 28px; border-radius: 999px; }
  .chip.chip-price { background: var(--accent); color: #fff; }
  .foot { margin-top: auto; display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 500; letter-spacing: .06em; color: var(--ink); }
  .foot img { width: 72px; height: 72px; }
  .foot .swipe { margin-left: auto; color: var(--accent); font-weight: 600; }
  .label { position: absolute; top: ${size.safeTop + 40}px; left: 48px; background: var(--accent); color: #fff; font-size: 32px; font-weight: 600; padding: 10px 26px; border-radius: 999px; letter-spacing: .04em; }
  .watermark { position: absolute; left: 48px; bottom: ${size.safeBottom + 40}px; color: #fff; font-size: 28px; font-weight: 500; letter-spacing: .06em; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
  .rows { margin-top: 36px; }
  .row { display: flex; justify-content: space-between; gap: 32px; padding: 20px 0; border-bottom: 2px solid #DDD3C4; font-size: 38px; }
  .row b { font-weight: 500; color: var(--quiet); font-size: 30px; letter-spacing: .14em; text-transform: uppercase; padding-top: 6px; white-space: nowrap; }
  .row span { text-align: right; font-weight: 500; }
  .price { margin-top: 40px; display: flex; align-items: baseline; gap: 24px; }
  .price b { font-size: 30px; letter-spacing: .14em; text-transform: uppercase; color: var(--quiet); font-weight: 500; }
  .price span { font-family: 'Playfair Display', serif; font-weight: 600; font-size: 150px; line-height: 1; color: var(--accent); }
  .note { margin-top: 18px; font-size: 32px; line-height: 1.35; }
  .points { margin: auto 0; padding-top: 48px; font-size: 54px; line-height: 1.3; }
  .point { display: flex; gap: 32px; margin-bottom: 0.9em; }
  .point i { font-style: normal; font-family: 'Playfair Display', serif; font-weight: 600; font-size: 1.35em; line-height: 1; color: var(--accent); min-width: 1.4em; }
  .rule { width: 120px; height: 5px; background: var(--accent); margin: 36px 0; }
  .dark { background: var(--ink); color: var(--cream); }
  .dark .foot { color: var(--accent2); }
  .cta-line { display: flex; gap: 24px; font-size: 48px; line-height: 1.3; margin-bottom: 30px; }
  .cta-line i { font-style: normal; color: var(--accent2); font-weight: 600; }
  .frame { position: absolute; inset: 28px; border: 2px solid var(--accent); opacity: .55; pointer-events: none; }
  `;
}

/** Tekst, który się nie mieści, zmniejsza się, aż wypełni swoje miejsce (data-fit = maks. wysokość w px). */
const FIT_SCRIPT = `<script>window.fit = () => { for (const el of document.querySelectorAll('[data-fit]')) { const max = Number(el.dataset.fit); let s = parseFloat(getComputedStyle(el).fontSize); while (el.scrollHeight > max && s > 18) { s -= 2; el.style.fontSize = s + 'px'; } } };</script>`;

function photoLayers(image: string, ctx: SlideContext): string {
  const url = esc(ctx.imageUrl(image));
  // Na TikToku (3:4, z marginesem na przyciski) całe zdjęcie na rozmytym tle, żeby nie obciąć rzeczy; na Instagramie (4:5) zdjęcie na cały kadr.
  return ctx.platform === "tiktok" ? `<img class="bg blur" src="${url}"><img class="fg" src="${url}">` : `<img class="bg" src="${url}">`;
}

function body(slide: Slide, ctx: SlideContext): string {
  const size = SLIDE_SIZES[ctx.platform];
  const counter = ctx.total > 1 ? `<div class="counter">${ctx.index + 1}/${ctx.total}</div>` : "";
  const handle = esc(ctx.handle);
  const foot = (swipe: boolean) =>
    `<div class="foot"><img src="${esc(ctx.logo.avatar)}"><span>${handle}</span>${swipe ? `<span class="swipe">Przesuń →</span>` : ""}</div>`;
  const last = ctx.index === ctx.total - 1;

  switch (slide.type) {
    case "cover": {
      if (slide.image) {
        const bottom = size.safeBottom + 64;
        return `${photoLayers(slide.image, ctx)}<div class="shade"></div>
          <div class="brand"><img src="${esc(ctx.logo.avatar)}"><span>${handle}</span></div>
          <div style="position:absolute;left:64px;right:${size.safeRight + 64}px;bottom:${bottom}px;color:#fff">
            ${slide.kicker ? `<div class="pill">${esc(slide.kicker)}</div>` : ""}
            <div class="hook" data-fit="330" style="font-size:86px;margin-top:22px;text-shadow:0 2px 14px rgba(0,0,0,.3)">${esc(slide.hook)}</div>
            ${slide.sub ? `<div style="font-size:36px;margin-top:18px;opacity:.95">${esc(slide.sub)}</div>` : ""}
            ${slide.chips.length ? `<div class="chips">${slide.chips.map((c, i) => `<span class="chip${i === slide.chips.length - 1 && /zł/.test(c) ? " chip-price" : ""}">${esc(c)}</span>`).join("")}</div>` : ""}
          </div>`;
      }
      return `<div class="frame"></div><div class="inner" style="align-items:center;text-align:center">
          <img src="${esc(ctx.logo.light)}" style="width:440px;margin-top:10px">
          <div style="margin-top:auto"></div>
          ${slide.kicker ? `<div class="kicker">${esc(slide.kicker)}</div>` : ""}
          <div class="hook" data-fit="${Math.round(size.height * 0.36)}" style="font-size:100px;margin-top:22px">${esc(slide.hook)}</div>
          <div class="rule"></div>
          ${slide.sub ? `<div style="font-size:40px;line-height:1.35;max-width:820px">${esc(slide.sub)}</div>` : ""}
          <div style="margin-top:auto"></div>
          <div class="foot" style="margin-top:0;justify-content:center;width:100%"><span style="color:var(--accent);font-weight:600">Przesuń →</span></div>
        </div>`;
    }
    case "photo":
      return `${photoLayers(slide.image, ctx)}${slide.label ? `<div class="label">${esc(slide.label)}</div>` : ""}${counter}<div class="watermark">${handle}</div>`;
    case "info":
      return `${counter}<div class="inner">
          <div class="kicker">Szczegóły</div>
          <div class="hook" data-fit="250" style="font-size:72px;margin-top:18px">${esc(slide.title)}</div>
          <div class="rows">${slide.rows.map((r) => `<div class="row"><b>${esc(r.label)}</b><span>${esc(r.value)}</span></div>`).join("")}</div>
          ${slide.price ? `<div class="price"><b>Cena</b><span>${esc(slide.price)}</span></div>` : ""}
          ${slide.note ? `<div class="note">${esc(slide.note)}</div>` : ""}
          ${foot(!last)}
        </div>`;
    case "text":
      return `${counter}<div class="inner">
          ${slide.kicker ? `<div class="kicker">${esc(slide.kicker)}</div>` : ""}
          <div class="hook" data-fit="${Math.round(size.height * 0.25)}" style="font-size:92px;margin-top:22px">${esc(slide.title)}</div>
          ${slide.points.length ? `<div class="points" data-fit="${Math.round(size.height * 0.48)}">${slide.points.map((p, i) => `<div class="point"><i>${i + 1}</i><span>${esc(p)}</span></div>`).join("")}</div>` : ""}
          ${foot(!last)}
        </div>`;
    case "cta":
      return `<div class="inner" style="justify-content:center">
          <img src="${esc(ctx.logo.dark)}" style="width:560px;align-self:center">
          <div class="hook" data-fit="300" style="font-size:96px;margin-top:56px;text-align:center">${esc(slide.title)}</div>
          <div class="rule" style="align-self:center"></div>
          <div style="align-self:center;max-width:860px">${slide.lines.map((l) => `<div class="cta-line"><i>→</i><span>${esc(l)}</span></div>`).join("")}</div>
          <div class="foot" style="justify-content:center;margin-top:48px"><span>${handle}</span></div>
        </div>`;
  }
}

export function slideHtml(slide: Slide, ctx: SlideContext): string {
  const size = SLIDE_SIZES[ctx.platform];
  const dark = slide.type === "cta" ? " dark" : "";
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><link rel="stylesheet" href="${esc(ctx.fontsCss)}"><style>${css(size)}</style>${FIT_SCRIPT}</head><body><div class="slide${dark}">${body(slide, ctx)}</div></body></html>`;
}
