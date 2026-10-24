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

PLAN ZDJĘĆ (imagePlan – opisy PO ANGIELSKU dla modelu generującego obrazy)
- productDescription: precyzyjny opis wyglądu produktu ze zdjęć (kształt, kolor, materiał, charakterystyczne elementy), 1–3 zdania.
- series: dokładnie tyle serii, ile wynosi liczba serii ogłoszeń OLX z wiadomości. Jedna seria = jedno ogłoszenie OLX = JEDNO pomieszczenie albo miejsce, pokazane z różnych miejsc i kątów. Różne serie to wyraźnie różne pomieszczenia (np. salon wieczorem, sypialnia rano, taras), dopasowane do miejsc, w których produkt jest naprawdę używany. "theme" zapisz po polsku (2–4 słowa).
- room: szczegółowy opis tego jednego pomieszczenia, 3–5 zdań: rodzaj i styl, kolor ścian, podłoga, główne meble i ich ustawienie, okna, dekoracje, światło i pora dnia. Musi wystarczyć, żeby wszystkie 6 zdjęć serii wyglądało jak zrobione w tym samym miejscu.
- shots: dokładnie 6 ujęć w tej kolejności, wszystkie w pomieszczeniu z "room": hero (okładka – produkt duży, w najatrakcyjniejszym miejscu pomieszczenia), in_use (produkt w użyciu; mogą być dłonie albo osoba bez widocznej twarzy), spot (produkt w innym miejscu tego samego pomieszczenia), detail (zbliżenie na najważniejszą cechę, pomieszczenie rozmyte w tle), wide (szeroki kadr całego pomieszczenia z produktem – widać jego wielkość), angle (inny kąt kamery, np. z góry albo z boku).
- "scene" opisuje tylko pozycję kamery, odległość, miejsce produktu w pomieszczeniu, czynność i kadr – nie opisuj pomieszczenia od nowa ani wyglądu produktu (model weźmie go ze zdjęcia referencyjnego). Każde z 6 ujęć ma wyraźnie inną pozycję kamery i odległość. Jeśli kierunek produktu ma znaczenie, napisz go wprost (np. projektor widziany z boku, obiektyw skierowany na ścianę z obrazem).
- Sceny realistyczne: nowoczesne polskie i europejskie wnętrza albo plenery. Bez napisów, logo i rozpoznawalnych treści na ekranach – ekrany i projekcje pokazują neutralny krajobraz lub abstrakcyjną grafikę. Nie dodawaj akcesoriów, które mogłyby wyglądać na część zestawu, jeśli ich w nim nie ma.

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

const FALLBACK_ROOMS = [
  "A bright modern Scandinavian living room: white walls, light oak floor, grey fabric sofa, low wooden coffee table, large window with sheer curtains, a few plants, soft daylight.",
  "A calm modern bedroom: warm beige walls, wooden floor, bed with white linen, bedside table with a lamp, big window, morning light.",
  "A tidy home office: light grey walls, wooden desk under a window, black chair, bookshelf with books and plants, daylight.",
  "A modern kitchen with dining area: white cabinets, light wooden worktop and table, pendant lamps, large window, bright daylight.",
  "A cosy terrace in the evening: wooden decking, outdoor sofa with cushions, plants in pots, string lights, warm sunset light.",
];

const FALLBACK_SCENES: Record<(typeof SHOT_KINDS)[number], string> = {
  hero: "the product large in the most attractive spot of the room, eye-level camera",
  in_use: "the product being used naturally, hands visible, face not visible",
  spot: "the product placed in another spot of the same room",
  detail: "close-up of the product's most important feature, the room softly blurred behind",
  wide: "wide shot of the whole room with the product, showing its size",
  angle: "the product from a different camera angle, slightly from above",
};

/** Pilnuje liczby serii i ujęć – model czasem zwraca o jedną serię lub ujęcie za mało. */
export function normalizeImagePlan(copy: ProductCopy, seriesCount: number): ProductCopy {
  const series = copy.imagePlan.series.slice(0, seriesCount);
  while (series.length < seriesCount) {
    const n = series.length;
    series.push({ theme: `Pomieszczenie ${n + 1}`, room: FALLBACK_ROOMS[n % FALLBACK_ROOMS.length]!, shots: [] });
  }
  const fixed = series.map((s, i) => ({
    theme: s.theme,
    room: s.room?.trim() || FALLBACK_ROOMS[i % FALLBACK_ROOMS.length]!,
    shots: SHOT_KINDS.map((kind) => s.shots.find((sh) => sh.kind === kind) ?? { kind, scene: FALLBACK_SCENES[kind] }),
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
