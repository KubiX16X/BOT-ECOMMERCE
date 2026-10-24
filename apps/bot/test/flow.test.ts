import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Update } from "grammy/types";

const generateOffer = vi.fn();

vi.mock("@revion/core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@revion/core")>();
  return { ...core, generateOffer, savePack: () => "/tmp/x.zip" };
});

const USER = { id: 42, is_bot: false, first_name: "Kuba" };
const CHAT = { id: 42, type: "private" as const, first_name: "Kuba" };
let updateId = 0;
let msgId = 0;

const msg = (extra: Record<string, unknown>): Update =>
  ({ update_id: ++updateId, message: { message_id: ++msgId, date: 0, chat: CHAT, from: USER, ...extra } }) as Update;
const text = (t: string) =>
  msg(t.startsWith("/") ? { text: t, entities: [{ type: "bot_command", offset: 0, length: t.split(" ")[0]!.length }] } : { text: t });
const cb = (data: string): Update =>
  ({
    update_id: ++updateId,
    callback_query: { id: String(updateId), from: USER, chat_instance: "1", data, message: { message_id: 1, date: 0, chat: CHAT } },
  }) as Update;

describe("bot – pełna rozmowa", () => {
  const calls: { method: string; payload: any }[] = [];
  let bot: import("grammy").Bot;

  beforeAll(async () => {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "revion-bot-"));
    process.env.TELEGRAM_ALLOWED_USER_IDS = "42";
    const { DEMO_COPY, renderListings } = await import("@revion/core");
    generateOffer.mockImplementation(async (input) => ({
      id: "t",
      createdAt: "",
      slug: "projektor",
      copy: DEMO_COPY,
      listings: renderListings(DEMO_COPY, { seriesCount: input.seriesCount, delivery: input.delivery, competitorKeywords: true }),
      images: [],
      failures: [],
      warnings: [],
      zip: Buffer.from("zip"),
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Buffer.from("jpeg-bytes"))));

    const { createBot } = await import("../src/bot");
    bot = createBot("123:abc", { botInfo: { id: 1, is_bot: true, first_name: "Revion", username: "revion_bot" } as any });
    bot.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload });
      const result = method === "getFile" ? { file_id: "f", file_unique_id: "u", file_path: "photos/1.jpg" } : { message_id: ++msgId, date: 0, chat: CHAT };
      return { ok: true, result } as any;
    });
  });

  const replies = () => calls.filter((c) => c.method === "sendMessage").map((c) => String(c.payload.text));

  it("odrzuca obcych i podaje ID", async () => {
    await bot.handleUpdate({ update_id: ++updateId, message: { message_id: 1, date: 0, chat: { ...CHAT, id: 7 }, from: { ...USER, id: 7 }, text: "hej" } } as Update);
    expect(replies().at(-1)).toBe("Brak dostępu.");
  });

  it("przeprowadza od zdjęcia do paczki", async () => {
    await bot.handleUpdate(text("/nowa"));
    await bot.handleUpdate(msg({ photo: [{ file_id: "small", file_unique_id: "s", width: 90, height: 90 }, { file_id: "big", file_unique_id: "b", width: 1280, height: 960 }] }));
    await bot.handleUpdate(cb("photos:done"));
    expect(replies().at(-1)).toContain("Wklej nazwę produktu");

    await bot.handleUpdate(text("Drukarka HP DeskJet 2720e https://allegro.pl/oferta/123 WiFi, druk w kolorze"));
    expect(replies().at(-1)).toContain("Wybierz kategorię OLX");

    await bot.handleUpdate(cb("cat:new"));
    await bot.handleUpdate(text("Elektronika > Drukarki"));
    expect(replies().at(-1)).toContain("Ile darmowych ogłoszeń");
    await bot.handleUpdate(cb("lim:2"));
    const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR!, "olx-limity.json"), "utf8"));
    expect(saved["Elektronika > Drukarki"]).toBe(2);

    await bot.handleUpdate(cb("dlv:2-4"));
    expect(replies().at(-1)).toContain("Wygeneruję 13 zdjęć AI");

    await bot.handleUpdate(cb("go:text"));
    await vi.waitFor(() => expect(calls.some((c) => c.method === "sendDocument")).toBe(true));

    const input = generateOffer.mock.calls[0]![0];
    expect(input).toMatchObject({
      seriesCount: 2,
      delivery: { min: 2, max: 4 },
      olxCategory: "Elektronika > Drukarki",
      sourceUrl: "https://allegro.pl/oferta/123",
    });
    expect(input.photos).toHaveLength(1);
    expect(generateOffer.mock.calls[0]![1].skipImages).toBe(true);
    expect(calls.find((c) => c.method === "getFile")!.payload.file_id).toBe("big");

    const all = replies();
    expect(all).toContain('Mini Projektor Rzutnik Android 11 Smart TV 4K WiFi Kino Domowe 130"');
    expect(all.some((t) => t.startsWith("◼ Produkt fabrycznie nowy") || t.startsWith("KONTAKT"))).toBe(true);
  });
});
