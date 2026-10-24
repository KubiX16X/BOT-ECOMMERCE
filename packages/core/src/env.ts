import fs from "node:fs";
import path from "node:path";

let repoRoot: string | undefined;

/** Katalog główny monorepo (ten z package.json zawierającym "workspaces"). */
export function findRepoRoot(start = process.cwd()): string {
  if (repoRoot) return repoRoot;
  let dir = path.resolve(/*turbopackIgnore: true*/ start);
  for (;;) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, "utf8")).workspaces) return (repoRoot = dir);
      } catch {
        // uszkodzony package.json – szukamy wyżej
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return (repoRoot = path.resolve(/*turbopackIgnore: true*/ start));
    dir = parent;
  }
}

let envLoaded = false;

/** Wczytuje .env z katalogu głównego (zmienne już ustawione w systemie mają pierwszeństwo). */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const file = path.join(findRepoRoot(), ".env");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export interface AppConfig {
  anthropicApiKey?: string;
  claudeModel: string;
  geminiApiKey?: string;
  geminiImageModel: string;
  sellerPhone?: string;
  sellerName?: string;
  olxCompetitorKeywords: boolean;
  dataDir: string;
  configDir: string;
}

export function getConfig(): AppConfig {
  loadEnv();
  const root = findRepoRoot();
  const e = process.env;
  const blankToUndef = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    anthropicApiKey: blankToUndef(e.ANTHROPIC_API_KEY),
    claudeModel: blankToUndef(e.CLAUDE_MODEL) ?? "claude-opus-5-5",
    geminiApiKey: blankToUndef(e.GEMINI_API_KEY),
    geminiImageModel: blankToUndef(e.GEMINI_IMAGE_MODEL) ?? "gemini-3.1-flash-image",
    sellerPhone: blankToUndef(e.SELLER_PHONE),
    sellerName: blankToUndef(e.SELLER_NAME),
    olxCompetitorKeywords: (e.OLX_COMPETITOR_KEYWORDS ?? "true").trim().toLowerCase() !== "false",
    dataDir: path.resolve(root, blankToUndef(e.DATA_DIR) ?? "data"),
    configDir: path.join(root, "config"),
  };
}
