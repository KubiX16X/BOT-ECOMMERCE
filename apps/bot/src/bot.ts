import {
  allegroImages,
  estimateImageCount,
  findOlxLimit,
  generateOffer,
  getConfig,
  getOlxLimits,
  MAX_SERIES,
  parseDelivery,
  savePack,
  seriesImages,
  setOlxLimit,
  type GeneratedImage,
  type OfferPack,
} from "@revion/core";
import { Bot, InlineKeyboard, InputFile, InputMediaBuilder, type BotConfig, type Context } from "grammy";
import { escapeHtml, extractUrl, parseAllowedIds, splitMessage } from "./text";

type Step = "photos" | "source" | "category" | "categoryName" | "categoryLimit" | "delivery" | "confirm" | "running";

interface Draft {
  step: Step;
  photoIds: string[];
  sourceText?: string;
  sourceUrl?: string;
  category?: string;
  seriesCount?: number;
  delivery?: { min: number; max: number };
  /** Kategorie pokazane na przyciskach (callback_data ma limit 64 bajtów, więc trzymamy indeks). */
  categoryChoices: string[];
  photoAckTimer?: NodeJS.Timeout;
}

const drafts = new Map<number, Draft>();

const HELP = [
  "<b>Generator ofert Revion</b>",
  "",
  "1. /nowa – zaczynasz nową ofertę",
  "2. Wysyłasz 1–3 zdjęcia produktu",
  "3. Wklejasz nazwę i opis/parametry z oferty źródłowej (może być z linkiem)",
  "4. Wybierasz kategorię OLX – liczba darmowych ogłoszeń = liczba serii zdjęć",
  "5. Podajesz przewidywaną dostawę",
  "",
  "Dostajesz: albumy zdjęć dla każdej serii, tytuły i opisy do skopiowania (OLX, Allegro) oraz ZIP ze wszystkim.",
  "",
  "/limity – zapisane limity OLX",
  "/limit 3 Elektronika > Telefony – zapisuje limit kategorii",
  "/anuluj – przerywa bieżącą ofertę",
].join("\n");

function newDraft(): Draft {
  return { step: "photos", photoIds: [], categoryChoices: [] };
}

function categoryKeyboard(draft: Draft): InlineKeyboard {
  const limits = getOlxLimits();
  draft.categoryChoices = Object.keys(limits).sort((a, b) => a.localeCompare(b, "pl"));
  const kb = new InlineKeyboard();
  draft.categoryChoices.forEach((c, i) => kb.text(`${c} (${limits[c]})`, `cat:${i}`).row());
  return kb.text("✍️ Inna kategoria", "cat:new");
}

const deliveryKeyboard = new InlineKeyboard()
  .text("1–2 dni", "dlv:1-2")
  .text("2–3 dni", "dlv:2-3")
  .row()
  .text("2–4 dni", "dlv:2-4")
  .text("3–5 dni", "dlv:3-5")
  .row()
  .text("✍️ Inny zakres", "dlv:custom");

function limitKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let n = 1; n <= 6; n++) kb.text(String(n), `lim:${n}`);
  return kb;
}

function summary(d: Draft): string {
  const images = estimateImageCount(d.seriesCount ?? 1);
  return [
    "<b>Podsumowanie</b>",
    `Zdjęcia produktu: ${d.photoIds.length}`,
    `Źródło: ${d.sourceText ? escapeHtml(d.sourceText.slice(0, 120)) + (d.sourceText.length > 120 ? "…" : "") : "brak (tylko zdjęcia)"}`,
    `Kategoria OLX: ${escapeHtml(d.category ?? "-")}`,
    `Serie (osobne ogłoszenia OLX): ${d.seriesCount}`,
    `Przewidywana dostawa: ${d.delivery?.min}–${d.delivery?.max} dni`,
    "",
    `Wygeneruję ${images} zdjęć AI (${d.seriesCount} × 5 scen + packshot na białym tle).`,
  ].join("\n");
}

const confirmKeyboard = new InlineKeyboard()
  .text("🚀 Generuj", "go:all")
  .text("📝 Tylko teksty", "go:text")
  .row()
  .text("✖️ Anuluj", "go:cancel");

export function createBot(token: string, config?: BotConfig<Context>): Bot {
  const bot = new Bot(token, config);
  const allowed = parseAllowedIds(process.env.TELEGRAM_ALLOWED_USER_IDS);

  // Dostęp tylko dla właściciela – każde generowanie kosztuje.
  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (id && allowed.has(id)) return next();
    if (ctx.message) {
      await ctx.reply(
        allowed.size === 0
          ? `Twoje ID w Telegramie: ${id}\nDopisz je do TELEGRAM_ALLOWED_USER_IDS w pliku .env i uruchom bota ponownie.`
          : "Brak dostępu.",
      );
    }
  });

  bot.command(["start", "pomoc"], (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));

  bot.command("nowa", async (ctx) => {
    drafts.set(ctx.chat.id, newDraft());
    await ctx.reply("📸 Wyślij 1–3 zdjęcia produktu (najlepiej jako plik, bez kompresji). Potem kliknij „Dalej”.");
  });

  bot.command("anuluj", async (ctx) => {
    const d = drafts.get(ctx.chat.id);
    if (d?.step === "running") return ctx.reply("Generowanie już trwa – poczekaj na wynik.");
    drafts.delete(ctx.chat.id);
    await ctx.reply("Anulowano. /nowa – zacznij od nowa.");
  });

  bot.command("limity", async (ctx) => {
    const limits = getOlxLimits();
    const lines = Object.entries(limits).map(([k, v]) => `• ${escapeHtml(k)}: <b>${v}</b>`);
    await ctx.reply(lines.length ? `<b>Limity darmowych ogłoszeń OLX</b>\n${lines.join("\n")}` : "Brak zapisanych limitów.", {
      parse_mode: "HTML",
    });
  });

  bot.command("limit", async (ctx) => {
    const m = /^(\d{1,2})\s+(.+)$/.exec(ctx.match.trim());
    if (!m) return ctx.reply("Użycie: /limit 3 Elektronika > Telefony");
    try {
      setOlxLimit(m[2]!, Number(m[1]));
      await ctx.reply(`Zapisano: ${m[2]} → ${m[1]} darmowych ogłoszeń.`);
    } catch (err) {
      await ctx.reply((err as Error).message);
    }
  });

  const addPhoto = async (ctx: Context, fileId: string) => {
    const chatId = ctx.chat!.id;
    let d = drafts.get(chatId);
    if (!d || d.step === "running") {
      if (d?.step === "running") return;
      d = newDraft();
      drafts.set(chatId, d);
    }
    if (d.step !== "photos") return ctx.reply("Zdjęcia przyjmuję na początku oferty. /nowa – zacznij od nowa.");
    if (d.photoIds.length >= 3) return;
    d.photoIds.push(fileId);
    // Album przychodzi jako kilka wiadomości – odpowiadamy raz, po chwili ciszy.
    clearTimeout(d.photoAckTimer);
    d.photoAckTimer = setTimeout(() => {
      void ctx.reply(`Mam ${d.photoIds.length}/3 zdjęć.`, { reply_markup: new InlineKeyboard().text("➡️ Dalej", "photos:done") });
    }, 1200);
  };

  bot.on("message:photo", (ctx) => addPhoto(ctx, ctx.message.photo.at(-1)!.file_id));
  bot.on("message:document", async (ctx) => {
    if (!ctx.message.document.mime_type?.startsWith("image/")) return ctx.reply("To nie jest zdjęcie.");
    await addPhoto(ctx, ctx.message.document.file_id);
  });

  bot.callbackQuery("photos:done", async (ctx) => {
    await ctx.answerCallbackQuery();
    const d = drafts.get(ctx.chat!.id);
    if (!d || d.step !== "photos" || d.photoIds.length === 0) return;
    d.step = "source";
    await ctx.reply(
      "📝 Wklej nazwę produktu i opis/parametry z oferty, z której kupujesz (możesz dodać link). Im więcej konkretów, tym lepszy opis.",
      { reply_markup: new InlineKeyboard().text("Pomiń – tylko zdjęcia", "source:skip") },
    );
  });

  const askCategory = async (ctx: Context, d: Draft) => {
    d.step = "category";
    await ctx.reply("🗂 Wybierz kategorię OLX (w nawiasie liczba darmowych ogłoszeń = liczba serii):", {
      reply_markup: categoryKeyboard(d),
    });
  };

  bot.callbackQuery("source:skip", async (ctx) => {
    await ctx.answerCallbackQuery();
    const d = drafts.get(ctx.chat!.id);
    if (d?.step === "source") await askCategory(ctx, d);
  });

  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const d = drafts.get(ctx.chat!.id);
    if (!d || d.step !== "category") return;
    const choice = ctx.match[1]!;
    if (choice === "new") {
      d.step = "categoryName";
      return ctx.reply("Wpisz kategorię OLX, np. „Dom i Ogród > Ogród > Grille”.");
    }
    const category = d.categoryChoices[Number(choice)];
    if (!category) return;
    d.category = category;
    d.seriesCount = findOlxLimit(category) ?? 1;
    d.step = "delivery";
    await ctx.reply(`Kategoria: ${category} → ${d.seriesCount} serie.\n🚚 Przewidywana dostawa (jak w ofercie źródłowej):`, {
      reply_markup: deliveryKeyboard,
    });
  });

  bot.callbackQuery(/^lim:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const d = drafts.get(ctx.chat!.id);
    if (!d || d.step !== "categoryLimit" || !d.category) return;
    d.seriesCount = Number(ctx.match[1]);
    setOlxLimit(d.category, d.seriesCount);
    d.step = "delivery";
    await ctx.reply(`Zapamiętałem: ${d.category} → ${d.seriesCount}.\n🚚 Przewidywana dostawa:`, { reply_markup: deliveryKeyboard });
  });

  bot.callbackQuery(/^dlv:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const d = drafts.get(ctx.chat!.id);
    if (!d || d.step !== "delivery") return;
    if (ctx.match[1] === "custom") return ctx.reply("Wpisz zakres dni roboczych, np. 3-6.");
    d.delivery = parseDelivery(ctx.match[1]!) ?? { min: 2, max: 4 };
    d.step = "confirm";
    await ctx.reply(summary(d), { parse_mode: "HTML", reply_markup: confirmKeyboard });
  });

  bot.callbackQuery(/^go:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat!.id;
    const d = drafts.get(chatId);
    if (!d || d.step !== "confirm") return;
    if (ctx.match[1] === "cancel") {
      drafts.delete(chatId);
      return ctx.reply("Anulowano. /nowa – zacznij od nowa.");
    }
    d.step = "running";
    // W tle – grammY obsługuje aktualizacje po kolei, a generowanie trwa 1–2 minuty.
    void runGeneration(bot, ctx, d, ctx.match[1] === "text")
      .catch(async (err) => {
        console.error(err);
        await ctx.reply(`❌ Błąd: ${(err as Error).message}`).catch(() => {});
      })
      .finally(() => drafts.delete(chatId));
  });

  bot.on("message:text", async (ctx) => {
    const d = drafts.get(ctx.chat.id);
    const text = ctx.message.text.trim();
    if (!d) return ctx.reply("Zacznij od /nowa (albo po prostu wyślij zdjęcie produktu).");
    switch (d.step) {
      case "photos":
        return ctx.reply("Najpierw wyślij zdjęcie produktu albo kliknij „Dalej”.");
      case "source":
        d.sourceText = text;
        d.sourceUrl = extractUrl(text);
        return askCategory(ctx, d);
      case "categoryName": {
        d.category = text;
        const known = findOlxLimit(text);
        if (known) {
          d.seriesCount = known;
          d.step = "delivery";
          return ctx.reply(`Znam tę kategorię: ${known} serie.\n🚚 Przewidywana dostawa:`, { reply_markup: deliveryKeyboard });
        }
        d.step = "categoryLimit";
        return ctx.reply("Ile darmowych ogłoszeń masz w tej kategorii na OLX? (zapamiętam)", { reply_markup: limitKeyboard() });
      }
      case "categoryLimit": {
        const n = Number(text);
        if (!Number.isInteger(n) || n < 1 || n > MAX_SERIES) return ctx.reply(`Podaj liczbę od 1 do ${MAX_SERIES}.`);
        d.seriesCount = n;
        setOlxLimit(d.category!, n);
        d.step = "delivery";
        return ctx.reply("🚚 Przewidywana dostawa:", { reply_markup: deliveryKeyboard });
      }
      case "delivery": {
        const delivery = parseDelivery(text);
        if (!delivery) return ctx.reply("Nie rozumiem – wpisz np. 2-4.");
        d.delivery = delivery;
        d.step = "confirm";
        return ctx.reply(summary(d), { parse_mode: "HTML", reply_markup: confirmKeyboard });
      }
      case "running":
        return ctx.reply("⏳ Generuję – poczekaj chwilę.");
      default:
        return ctx.reply("Użyj przycisków powyżej albo /anuluj.");
    }
  });

  bot.catch((err) => console.error("Błąd bota:", err.error));
  return bot;
}

async function downloadPhoto(bot: Bot, fileId: string): Promise<Buffer> {
  const file = await bot.api.getFile(fileId);
  const res = await fetch(`https://api.telegram.org/file/bot${bot.token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Nie udało się pobrać zdjęcia z Telegrama (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

async function runGeneration(bot: Bot, ctx: Context, d: Draft, textOnly: boolean): Promise<void> {
  const chatId = ctx.chat!.id;
  const status = await ctx.reply("⏳ Zaczynam…");
  let lastEdit = 0;
  let lastText = "";
  const setStatus = async (text: string, force = false) => {
    if (text === lastText || (!force && Date.now() - lastEdit < 1500)) return;
    lastEdit = Date.now();
    lastText = text;
    await bot.api.editMessageText(chatId, status.message_id, `⏳ ${text}`).catch(() => {});
  };

  const photos = await Promise.all(d.photoIds.map((id) => downloadPhoto(bot, id)));
  const pack = await generateOffer(
    {
      photos,
      sourceText: d.sourceText,
      sourceUrl: d.sourceUrl,
      olxCategory: d.category,
      seriesCount: d.seriesCount ?? 1,
      delivery: d.delivery ?? { min: 2, max: 4 },
    },
    { skipImages: textOnly, onProgress: (p) => void setStatus(p.message) },
  );
  savePack(pack);
  await bot.api.editMessageText(chatId, status.message_id, "✅ Gotowe! Wysyłam…").catch(() => {});
  await sendPack(ctx, pack);
}

async function sendAlbum(ctx: Context, images: GeneratedImage[], caption: string) {
  if (images.length === 0) return;
  const media = images.slice(0, 10).map((img, i) =>
    InputMediaBuilder.photo(new InputFile(img.data, img.fileName), i === 0 ? { caption, parse_mode: "HTML" } : {}),
  );
  await ctx.replyWithMediaGroup(media);
}

async function sendPlain(ctx: Context, text: string) {
  for (const part of splitMessage(text)) await ctx.reply(part, { link_preview_options: { is_disabled: true } });
}

async function sendPack(ctx: Context, pack: OfferPack): Promise<void> {
  for (const s of pack.listings.olx) {
    await sendAlbum(ctx, seriesImages(pack.images, s.series), `<b>OLX – seria ${s.series}</b> (${escapeHtml(s.theme)})`);
    await ctx.reply(`<b>OLX seria ${s.series} – tytuł</b> (${s.title.length}/${s.title.limit}). Przytrzymaj wiadomość niżej, żeby skopiować:`, {
      parse_mode: "HTML",
    });
    await sendPlain(ctx, s.title.title);
    await ctx.reply(`<b>OLX seria ${s.series} – opis:</b>`, { parse_mode: "HTML" });
    await sendPlain(ctx, s.description);
  }

  const a = pack.listings.allegro;
  await sendAlbum(ctx, allegroImages(pack.images), "<b>Allegro</b> – pierwsze zdjęcie na białym tle");
  await ctx.reply(`<b>Allegro – tytuł</b> (${a.title.length}/${a.title.limit}):`, { parse_mode: "HTML" });
  await sendPlain(ctx, a.title.title);
  await ctx.reply("<b>Allegro – opis</b> (bez telefonu i płatności poza Allegro):", { parse_mode: "HTML" });
  await sendPlain(ctx, a.description);

  const notes = [`Sugerowana kategoria OLX: ${pack.copy.olxCategorySuggestion}`, ...pack.warnings.map((w) => `⚠️ ${w}`)];
  await ctx.replyWithDocument(new InputFile(pack.zip, `${pack.slug}.zip`), {
    caption: `📦 Cała paczka (zdjęcia, teksty, wersja Revion).\n\n${notes.join("\n")}`.slice(0, 1024),
  });
  const config = getConfig();
  if (!config.sellerPhone) await ctx.reply("ℹ️ Ustaw SELLER_PHONE w .env, żeby numer pojawiał się w opisach OLX.");
}
