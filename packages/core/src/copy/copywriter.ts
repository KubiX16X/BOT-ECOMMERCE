import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { getConfig } from "../env";
import { ProductCopySchema, SHOT_KINDS, type ProductCopy } from "./schema";

const SYSTEM_PROMPT = `Jesteś copywriterem e-commerce. Piszesz oferty sprzedażowe na OLX, Allegro i do sklepu internetowego Revion. Sprzedawca odsprzedaje nowe produkty. Dostajesz zdjęcia produktu i tekst skopiowany z oferty źródłowej (nazwa, opis, parametry).

ZASADY PRAWDY (najważniejsze)
- Używaj wyłącznie faktów widocznych na zdjęciach albo zapisanych w tekście źródłowym. Nie wymyślaj parametrów, certyfikatów, gwarancji, pochodzenia marki ani zawartości zestawu.
- Jeśli czegoś brakuje, pomiń to i dopisz krótką uwagę po polsku do "warnings".
- Nie pisz o czasie dostawy, płatnościach, zwrotach ani cenie – te części dokłada szablon sprzedawcy.

TYTUŁY
- Kupujący szukają po pojedynczych słowach, więc tytuł to ciąg fraz wyszukiwania, a nie zdanie. Na początku rodzaj produktu i jego synonimy, potem marka i model, potem kluczowe cechy (parametry, zastosowanie).
- Każde słowo zaczynaj wielką literą. Skróty pisz wielkimi literami (TV, LED, HDMI, 4K), jednostki poprawnie (5000mAh, 2.4GHz).
- Bez wykrzykników, emoji i słów typu "okazja", "hit", "promocja", "najtańszy". Bez nazw innych marek.
- olxTitles: podaj o 2 warianty więcej, niż wynosi liczba serii ogłoszeń OLX z wiadomości. Każdy wariant ma maksymalnie 70 znaków i łapie INNE wyszukiwania: inny zestaw synonimów i cech (wariant 1: główne frazy; wariant 2: synonimy i zastosowania; wariant 3: parametry i model; kolejne: inne kombinacje). Warianty nie mogą być tylko przestawionymi słowami.
- allegroTitle: maksymalnie 75 znaków, najtrafniejsze frazy.
- storeTitle: naturalna nazwa do sklepu, maksymalnie 90 znaków, też każde słowo wielką literą.

OPIS (układ F-pattern: najważniejsze słowa na początku każdej linii)
- intro: 2–3 zdania. Pierwsze to mocny haczyk (problem albo marzenie kupującego), dalej co to jest i co daje. Zwracaj się do kupującego na "Ty".
- benefits: 6–9 punktów. "feature" to krótka nazwa cechy otwierająca linię (2–5 słów, wielką literą), "benefit" to konkretna korzyść, z liczbami ze źródła. Bez kropki na końcu.
- specs: parametry techniczne ze źródła. "name" wielką literą, "value" z jednostkami. 6–12 pozycji, jeśli źródło na to pozwala.
- closing: 1–2 zdania – dla kogo i do czego jest produkt.
- setContents: elementy zestawu; jeśli źródło ich nie podaje, tylko sam produkt.

SŁOWA KLUCZOWE
- keywords: 15–25 fraz małymi literami, które kupujący wpisują w wyszukiwarkę OLX: synonimy, potoczne nazwy, zastosowania, odmiany. Bez nazw innych marek.
- competitorKeywords: 0–5 fraz z nazwami popularnych konkurencyjnych produktów, tylko jeśli produkt jest ich realnym zamiennikiem (np. "samsung freestyle zamiennik"). W innym wypadku pusta lista.

PLAN ZDJĘĆ (imagePlan – opisy scen PO ANGIELSKU dla modelu generującego obrazy)
- productDescription: precyzyjny opis wyglądu produktu ze zdjęć (kształt, kolor, materiał, charakterystyczne elementy), 1–3 zdania.
- series: dokładnie tyle serii, ile wynosi liczba serii ogłoszeń OLX z wiadomości. Każda seria ma INNY motyw otoczenia (inne pomieszczenie, pora dnia, styl wnętrza albo plener), dopasowany do miejsc, w których produkt jest naprawdę używany. "theme" zapisz po polsku (2–4 słowa).
- Każda seria ma dokładnie 5 ujęć w tej kolejności: hero (okładka – produkt duży, na środku, w atrakcyjnym otoczeniu), in_use (produkt w użyciu; mogą być dłonie albo osoba bez widocznej twarzy), context (inne zastosowanie lub miejsce w tym samym motywie), detail (zbliżenie na najważniejszą cechę), scale (szerszy kadr pokazujący wielkość produktu w otoczeniu).
- Sceny realistyczne: nowoczesne polskie i europejskie wnętrza albo plenery. Bez napisów, logo i rozpoznawalnych treści na ekranach – ekrany i projekcje pokazują neutralny krajobraz lub abstrakcyjną grafikę. Nie dodawaj akcesoriów, które mogłyby wyglądać na część zestawu, jeśli ich w nim nie ma.
- Opisuj tylko scenę, ustawienie produktu, światło i kadr. Wygląd produktu model weźmie ze zdjęcia referencyjnego.

olxCategorySuggestion: najlepiej pasująca ścieżka kategorii OLX, np. "Elektronika > TV i Video > Projektory".`;

export interface CopyInput {
  photos: Buffer[];
  productName?: string;
  sourceText?: string;
  olxCategory?: string;
  seriesCount: number;
}

async function toClaudeImage(photo: Buffer): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const jpeg = await sharp(photo).rotate().resize(1568, 1568, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } };
}

function buildUserText(input: CopyInput): string {
  return [
    `Liczba serii ogłoszeń OLX: ${input.seriesCount}`,
    `Kategoria OLX od sprzedawcy: ${input.olxCategory?.trim() || "brak – zaproponuj"}`,
    `Nazwa produktu od sprzedawcy: ${input.productName?.trim() || "brak – ustal ze zdjęć i źródła"}`,
    "Tekst z oferty źródłowej:",
    "<zrodlo>",
    input.sourceText?.trim() || "(brak – opieraj się tylko na zdjęciach)",
    "</zrodlo>",
  ].join("\n");
}

/** Pilnuje liczby serii i ujęć – model czasem zwraca o jedną serię za mało. */
export function normalizeImagePlan(copy: ProductCopy, seriesCount: number): ProductCopy {
  const series = copy.imagePlan.series.slice(0, seriesCount);
  const fallbackScene: Record<(typeof SHOT_KINDS)[number], string> = {
    hero: "the product as the hero of a bright, modern, tidy interior, centered, eye level",
    in_use: "the product being used naturally, hands visible, face not visible",
    context: "the product in another typical place where it is used",
    detail: "close-up of the product's most important feature, shallow depth of field",
    scale: "wide shot showing the product in a room for a sense of its size",
  };
  while (series.length < seriesCount) {
    const base = series[series.length % Math.max(series.length, 1)];
    series.push({
      theme: base ? `${base.theme} – wariant ${series.length + 1}` : `Motyw ${series.length + 1}`,
      shots: SHOT_KINDS.map((kind) => ({ kind, scene: `${fallbackScene[kind]}, alternative interior style and time of day` })),
    });
  }
  const fixed = series.map((s) => ({
    theme: s.theme,
    shots: SHOT_KINDS.map((kind) => s.shots.find((sh) => sh.kind === kind) ?? { kind, scene: fallbackScene[kind] }),
  }));
  return { ...copy, imagePlan: { ...copy.imagePlan, series: fixed } };
}

export async function writeProductCopy(input: CopyInput): Promise<ProductCopy> {
  const config = getConfig();
  if (!config.anthropicApiKey) throw new Error("Brak ANTHROPIC_API_KEY w pliku .env – nie mogę napisać tekstów.");
  if (input.photos.length === 0 && !input.sourceText?.trim() && !input.productName?.trim()) {
    throw new Error("Podaj przynajmniej zdjęcie, nazwę albo tekst z oferty źródłowej.");
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const images = await Promise.all(input.photos.slice(0, 3).map(toClaudeImage));

  const response = await client.beta.messages.parse({
    model: config.claudeModel,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ProductCopySchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [...images, { type: "text", text: buildUserText(input) }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Model odmówił napisania oferty (${response.stop_details?.category ?? "bez kategorii"}).`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Odpowiedź modelu została ucięta (limit tokenów). Spróbuj krótszego tekstu źródłowego.");
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Nie udało się odczytać odpowiedzi modelu jako JSON.");
  return normalizeImagePlan(parsed, input.seriesCount);
}
