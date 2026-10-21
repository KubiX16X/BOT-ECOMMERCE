import { afterEach, describe, expect, it, vi } from "vitest";
import { generateGeminiImage, ImageGenerationError } from "../src/images/gemini";

const req = { apiKey: "k", model: "gemini-2.5-flash-image", prompt: "p", references: [{ data: Buffer.from("x"), mimeType: "image/jpeg" }], aspectRatio: "4:3" as const };

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("generateGeminiImage", () => {
  it("wysyła zdjęcie referencyjne i bierze finalny obraz (pomija szkice)", async () => {
    const fetchMock = mockFetch(200, {
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: "image/png", data: Buffer.from("draft").toString("base64") }, thought: true },
              { text: "ok" },
              { inlineData: { mimeType: "image/png", data: Buffer.from("final").toString("base64") } },
            ],
          },
        },
      ],
    });
    const out = await generateGeminiImage(req);
    expect(out.toString()).toBe("final");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-2.5-flash-image:generateContent");
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe("image/jpeg");
    expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } });
  });

  it("429 jest do ponowienia, blokada bezpieczeństwa nie", async () => {
    mockFetch(429, { error: { message: "quota" } });
    await expect(generateGeminiImage(req)).rejects.toMatchObject({ retryable: true });
    mockFetch(200, { candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] });
    const err = await generateGeminiImage(req).catch((e) => e);
    expect(err).toBeInstanceOf(ImageGenerationError);
    expect(err.retryable).toBe(false);
  });
});
