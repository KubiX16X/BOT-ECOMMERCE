// Posty-karuzele na Instagram (1080×1350) i TikTok (1080×1920) z planu JSON, który pisze Claude w rozmowie:
//   npm run posty -- --plan data/posty/kamizelka-zara.json
// Ścieżki zdjęć w planie liczą się od katalogu pliku z planem. Wynik: data/posty/<data>-<nazwa>/ + ZIP.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { getConfig } from "../env";
import { slugify } from "../text/format";
import { renderSocialPost } from "./render";
import { SocialPostSchema } from "./schema";

const { values } = parseArgs({ options: { plan: { type: "string" } } });
if (!values.plan) {
  console.error("Podaj plan posta: npm run posty -- --plan data/posty/<plik>.json");
  process.exit(1);
}

const planPath = path.resolve(values.plan);
const parsed = SocialPostSchema.safeParse(JSON.parse(fs.readFileSync(planPath, "utf8")));
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`Błąd w planie (${issue.path.join(".")}): ${issue.message}`);
  process.exit(1);
}

const post = parsed.data;
const outDir = path.join(getConfig().dataDir, "posty", `${new Date().toISOString().slice(0, 10)}-${slugify(post.name)}`);
const result = await renderSocialPost(post, { baseDir: path.dirname(planPath), outDir });

console.log(`Slajdy: ${post.slides.length} × Instagram i TikTok`);
console.log(`Hasztagi IG: ${post.instagram.hashtags.map((h) => `#${h}`).join(" ") || "brak"}`);
console.log(`Hasztagi TikTok: ${post.tiktok.hashtags.map((h) => `#${h}`).join(" ") || "brak"}`);
if (post.tiktok.title) console.log(`Tytuł TikTok: ${post.tiktok.title}`);
console.log(`Podgląd: ${result.preview}`);
console.log(`Paczka: ${result.zipPath}`);
