import { DEMO_COPY, MAX_SERIES, setOlxLimit } from "@revion/core";
import { isAdmin } from "@/lib/auth";
import { jobView, startJob } from "@/lib/jobs";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function int(value: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 401 });

  const form = await request.formData();

  // Podgląd wyniku bez kluczy API: przykładowy projektor, same teksty.
  if (form.get("demo") === "on") {
    const job = startJob({ photos: [], seriesCount: 2, delivery: { min: 2, max: 4 } }, { copy: DEMO_COPY, skipImages: true });
    return Response.json(jobView(job), { status: 202 });
  }
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 3) return Response.json({ error: "Maksymalnie 3 zdjęcia produktu." }, { status: 400 });
  if (files.some((f) => !f.type.startsWith("image/") || f.size > MAX_PHOTO_BYTES)) {
    return Response.json({ error: "Zdjęcia muszą być plikami graficznymi do 15 MB." }, { status: 400 });
  }

  const sourceText = String(form.get("sourceText") ?? "").trim();
  if (files.length === 0 && !sourceText) {
    return Response.json({ error: "Dodaj zdjęcie produktu albo wklej opis z oferty źródłowej." }, { status: 400 });
  }

  const seriesCount = int(form.get("seriesCount"), 1, MAX_SERIES);
  const min = int(form.get("deliveryMin"), 1, 60);
  const max = int(form.get("deliveryMax"), 1, 60);
  if (!seriesCount || !min || !max || max < min) {
    return Response.json({ error: "Sprawdź liczbę serii i zakres dostawy." }, { status: 400 });
  }

  const category = String(form.get("category") ?? "").trim() || undefined;
  if (category && form.get("saveLimit") === "on") setOlxLimit(category, seriesCount);

  const job = startJob(
    {
      photos: await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()))),
      sourceText: sourceText || undefined,
      sourceUrl: /https?:\/\/\S+/i.exec(sourceText)?.[0],
      olxCategory: category,
      seriesCount,
      delivery: { min, max },
    },
    { skipImages: form.get("textOnly") === "on" },
  );
  return Response.json(jobView(job), { status: 202 });
}
