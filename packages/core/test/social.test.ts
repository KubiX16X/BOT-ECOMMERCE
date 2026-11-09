import { describe, expect, it } from "vitest";
import { MAX_HASHTAGS, normalizeHashtags, SocialPostSchema } from "../src/social/schema";
import { captionText, slideHtml, type SlideContext } from "../src/social/slides";

const plan = (hashtags: string[]) => ({
  name: "Kamizelka Zara",
  slides: [
    { type: "cover", image: "foto.jpg", hook: "Kamizelka <puchowa> & ciepła", chips: ["M", "89 zł"] },
    { type: "cta", title: "Chcesz ją?", lines: ["Napisz „CHCĘ” w wiadomości"] },
  ],
  instagram: { caption: "Opis IG", hashtags },
  tiktok: { caption: "Opis TikTok", hashtags: ["#zara"] },
});

const ctx = (platform: "instagram" | "tiktok"): SlideContext => ({
  platform,
  index: 0,
  total: 2,
  handle: "@prawienowebykuba",
  fontsCss: "file:///fonts.css",
  logo: { light: "file:///l.svg", dark: "file:///d.svg", avatar: "file:///a.svg" },
  imageUrl: (i) => `file:///zdjecia/${i}`,
});

describe("hasztagi", () => {
  it("normalizuje: bez #, spacji, powtórzeń", () => {
    expect(normalizeHashtags(["#Moda Damska", "modadamska", "##OOTD", " "])).toEqual(["modadamska", "ootd"]);
  });

  it(`najwyżej ${MAX_HASHTAGS} na platformę`, () => {
    expect(SocialPostSchema.safeParse(plan(["a", "b", "c", "d", "e"])).success).toBe(true);
    const tooMany = SocialPostSchema.safeParse(plan(["a", "b", "c", "d", "e", "f"]));
    expect(tooMany.success).toBe(false);
  });

  it("tytuł TikToka ma najwyżej 90 znaków", () => {
    const withTitle = (title: string) => ({ ...plan([]), tiktok: { caption: "Opis", title } });
    expect(SocialPostSchema.safeParse(withTitle("Kamizelka Zara za 89 zł")).success).toBe(true);
    expect(SocialPostSchema.safeParse(withTitle("x".repeat(91))).success).toBe(false);
  });

  it("opis kończy się hasztagami", () => {
    const post = SocialPostSchema.parse(plan(["#Zara", "kamizelka"]));
    expect(captionText(post, "instagram")).toBe("Opis IG\n\n#zara #kamizelka\n");
  });
});

describe("slajdy", () => {
  const post = SocialPostSchema.parse(plan([]));

  it("tekst jest escapowany, a cena wyróżniona", () => {
    const html = slideHtml(post.slides[0]!, ctx("instagram"));
    expect(html).toContain("Kamizelka &lt;puchowa&gt; &amp; ciepła");
    expect(html).toContain('class="chip chip-price">89 zł');
    expect(html).toContain("width: 1080px; height: 1350px");
  });

  it("TikTok 3:4 pokazuje całe zdjęcie na rozmytym tle", () => {
    const html = slideHtml(post.slides[0]!, ctx("tiktok"));
    expect(html).toContain("width: 1080px; height: 1440px");
    expect(html).toContain('class="bg blur"');
    expect(html).toContain('class="fg" src="file:///zdjecia/foto.jpg"');
  });
});
