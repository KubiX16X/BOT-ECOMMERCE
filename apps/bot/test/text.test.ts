import { describe, expect, it } from "vitest";
import { extractUrl, parseAllowedIds, splitMessage } from "../src/text";

describe("bot text helpers", () => {
  it("dzieli długie opisy na granicy akapitów", () => {
    const para = "◼ " + "a".repeat(900);
    const text = Array.from({ length: 6 }, () => para).join("\n\n");
    const parts = splitMessage(text, 2000);
    expect(parts.every((p) => p.length <= 2000)).toBe(true);
    expect(parts.join("\n\n")).toBe(text);
  });

  it("wyciąga link i parsuje listę ID", () => {
    expect(extractUrl("Drukarka HP https://allegro.pl/oferta/123 super")).toBe("https://allegro.pl/oferta/123");
    expect([...parseAllowedIds("123, 456 x")]).toEqual([123, 456]);
    expect(parseAllowedIds(undefined).size).toBe(0);
  });
});
