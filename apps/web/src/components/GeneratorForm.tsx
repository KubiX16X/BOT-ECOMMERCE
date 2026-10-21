"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobImage, JobView } from "@/lib/jobs";
import { CopyButton } from "./CopyButton";

const NEW_CATEGORY = "__new";
const KIND_ORDER = ["hero", "in_use", "context", "detail", "scale", "packshot"];

interface Props {
  limits: Record<string, number>;
  maxSeries: number;
  setup: { claude: boolean; gemini: boolean; phone: boolean };
}

const input = "w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-gold";

export function GeneratorForm({ limits, maxSeries, setup }: Props) {
  const categories = useMemo(() => Object.keys(limits).sort((a, b) => a.localeCompare(b, "pl")), [limits]);
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(categories[0] ?? NEW_CATEGORY);
  const [newCategory, setNewCategory] = useState("");
  const [seriesCount, setSeriesCount] = useState(limits[categories[0] ?? ""] ?? 1);
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    if (category !== NEW_CATEGORY) setSeriesCount(limits[category] ?? 1);
  }, [category, limits]);

  // Na telefonie wyniki są pod formularzem – przewijamy do nich po starcie.
  useEffect(() => {
    if (job?.id && window.innerWidth < 1024) resultsRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [job?.id]);

  // Odpytujemy serwer, dopóki zadanie trwa.
  useEffect(() => {
    if (job?.status !== "running") return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/generator/${job.id}`);
      const data = await res.json();
      if (res.ok) setJob(data);
      else {
        setError(data.error ?? "Błąd odczytu zadania");
        setJob(null);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [job]);

  async function send(data: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/generator", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setJob(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.delete("photos");
    files.forEach((f) => data.append("photos", f));
    data.set("category", category === NEW_CATEGORY ? newCategory : category);
    void send(data);
  }

  function demo() {
    const data = new FormData();
    data.set("demo", "on");
    void send(data);
  }

  const running = submitting || job?.status === "running";
  const progress = job?.progress;
  const pct = progress?.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-panel p-5 lg:sticky lg:top-6 lg:self-start">
        <h1 className="text-lg font-semibold">Nowa oferta</h1>

        {(!setup.claude || !setup.gemini || !setup.phone) && (
          <div className="space-y-1 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-gold">
            {!setup.claude && <p>Brak ANTHROPIC_API_KEY – teksty nie zadziałają.</p>}
            {!setup.gemini && <p>Brak GEMINI_API_KEY – paczka będzie bez zdjęć AI.</p>}
            {!setup.phone && <p>Brak SELLER_PHONE – opisy OLX bez numeru telefonu.</p>}
          </div>
        )}

        <div>
          <label className="text-sm text-muted">Zdjęcia produktu (1–3)</label>
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-line file:px-3 file:py-2 file:text-white"
          />
          {previews.length > 0 && (
            <div className="mt-2 flex gap-2">
              {previews.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm text-muted" htmlFor="sourceText">
            Nazwa i opis z oferty źródłowej (może być z linkiem)
          </label>
          <textarea
            id="sourceText"
            name="sourceText"
            rows={7}
            placeholder={"Drukarka HP DeskJet 2720e\nhttps://allegro.pl/oferta/...\nDruk w kolorze, WiFi, skaner..."}
            className={`${input} mt-1 text-sm`}
          />
        </div>

        <div>
          <label className="text-sm text-muted" htmlFor="category">
            Kategoria OLX
          </label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} mt-1`}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({limits[c]})
              </option>
            ))}
            <option value={NEW_CATEGORY}>✍️ Inna kategoria…</option>
          </select>
          {category === NEW_CATEGORY && (
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="np. Elektronika > Drukarki"
              className={`${input} mt-2`}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-muted" htmlFor="seriesCount">
              Darmowe ogłoszenia = serie
            </label>
            <input
              id="seriesCount"
              name="seriesCount"
              type="number"
              min={1}
              max={maxSeries}
              value={seriesCount}
              onChange={(e) => setSeriesCount(Number(e.target.value))}
              className={`${input} mt-1`}
            />
          </div>
          <div>
            <label className="text-sm text-muted">Dostawa (dni robocze)</label>
            <div className="mt-1 flex items-center gap-1">
              <input name="deliveryMin" type="number" min={1} max={60} defaultValue={2} className={input} />
              <span className="text-muted">–</span>
              <input name="deliveryMax" type="number" min={1} max={60} defaultValue={4} className={input} />
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="saveLimit" defaultChecked className="accent-gold" /> Zapamiętaj limit tej kategorii
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="textOnly" className="accent-gold" /> Tylko teksty (bez zdjęć AI)
          </label>
        </div>

        <p className="text-xs text-muted">
          Zdjęcia AI: {seriesCount * 5 + 1} ({seriesCount} × 5 scen + packshot na białym tle).
        </p>

        <button
          disabled={running}
          className="w-full rounded-xl bg-gold py-3 font-semibold text-ink transition hover:bg-gold-dark disabled:cursor-wait disabled:opacity-60"
        >
          {running ? "Generuję…" : "Generuj ofertę →"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={demo} disabled={running} className="w-full text-center text-xs text-muted underline hover:text-white">
          Zobacz przykład wyniku (projektor, bez kluczy API)
        </button>
      </form>

      <section ref={resultsRef} className="min-w-0 scroll-mt-4 space-y-6">
        {!job && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
            Tu pojawią się serie zdjęć, tytuły i opisy gotowe do wklejenia.
          </div>
        )}

        {job?.status === "running" && (
          <div className="rounded-2xl border border-line bg-panel p-6">
            <p className="font-medium">{progress?.message}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full bg-gold transition-all ${pct === null ? "w-1/3 animate-pulse" : ""}`}
                style={pct === null ? undefined : { width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">Teksty ok. 30–60 s, zdjęcia ok. 10 s na sztukę (po 3 naraz).</p>
          </div>
        )}

        {job?.status === "error" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">Błąd: {job.error}</div>
        )}

        {job?.result && <Result jobId={job.id} result={job.result} />}
      </section>
    </div>
  );
}

function sortImages(images: JobImage[]): JobImage[] {
  return [...images].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

function Gallery({ images }: { images: JobImage[] }) {
  if (images.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {images.map((img, i) => (
        <a key={img.name} href={img.url} target="_blank" rel="noreferrer" className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.kind} className="aspect-[4/3] w-full rounded-lg border border-line object-cover group-hover:border-gold" />
          <span className="absolute left-1 top-1 rounded bg-ink/80 px-1.5 text-xs">{i + 1}</span>
        </a>
      ))}
    </div>
  );
}

function Field({ label, text, count, limit }: { label: string; text: string; count?: number; limit?: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm text-muted">{label}</span>
        {count !== undefined && (
          <span className={`text-xs ${limit && count > limit ? "text-red-400" : "text-muted"}`}>
            {count}/{limit}
          </span>
        )}
        <span className="ml-auto">
          <CopyButton text={text} />
        </span>
      </div>
      {text.includes("\n") ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink p-3 text-sm">{text}</pre>
      ) : (
        <p className="rounded-lg border border-line bg-ink px-3 py-2 font-medium">{text}</p>
      )}
    </div>
  );
}

function Result({ jobId, result }: { jobId: string; result: NonNullable<JobView["result"]> }) {
  const packshot = result.images.filter((i) => i.kind === "packshot");
  const { listings } = result;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel p-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{result.productName}</h2>
          <p className="text-sm text-muted">Sugerowana kategoria OLX: {result.olxCategorySuggestion}</p>
        </div>
        <a href={`/api/admin/generator/${jobId}/zip`} className="ml-auto rounded-xl bg-gold px-4 py-2 font-semibold text-ink hover:bg-gold-dark">
          Pobierz ZIP
        </a>
      </div>

      {(result.warnings.length > 0 || result.failures.length > 0) && (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          <p className="font-semibold">Sprawdź przed wystawieniem:</p>
          <ul className="mt-1 list-disc pl-5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
            {result.failures.map((f) => (
              <li key={`${f.series}-${f.kind}`}>
                Zdjęcie {f.series ? `seria ${f.series}` : "packshot"} / {f.kind}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {listings.olx.map((s) => (
        <article key={s.series} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
          <h3 className="font-semibold">
            OLX · ogłoszenie {s.series} <span className="text-muted">· {s.theme}</span>
          </h3>
          <Gallery images={[...sortImages(result.images.filter((i) => i.series === s.series)), ...packshot]} />
          <Field label="Tytuł" text={s.title.title} count={s.title.length} limit={s.title.limit} />
          <Field label="Opis" text={s.description} />
        </article>
      ))}

      <article className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-semibold">
          Allegro <span className="text-muted">· packshot jako pierwsze zdjęcie</span>
        </h3>
        <Gallery images={[...packshot, ...sortImages(result.images.filter((i) => i.series === 1))]} />
        <Field label="Tytuł" text={listings.allegro.title.title} count={listings.allegro.title.length} limit={listings.allegro.title.limit} />
        <Field label="Opis" text={listings.allegro.description} />
        <Field label="Opis HTML (API Allegro)" text={listings.allegro.html} />
      </article>

      <article className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-semibold">Revion · strona produktu</h3>
        <Field label="Nazwa" text={listings.revion.title.title} />
        <div className="revion-html rounded-lg border border-line bg-ink p-4 text-sm" dangerouslySetInnerHTML={{ __html: listings.revion.html }} />
      </article>
    </>
  );
}
