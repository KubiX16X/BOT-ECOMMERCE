import Link from "next/link";
import { AdminHeader } from "@/components/AdminHeader";
import { requireAdmin } from "@/lib/auth";

const tiles = [
  { href: "/admin/generator", title: "Generator ofert", text: "Zdjęcie produktu → serie zdjęć AI, tytuły i opisy na OLX, Allegro i Revion.", ready: true },
  { href: "#", title: "Produkty i sklep", text: "Katalog Revion, kategorie, płatności Stripe i BLIK.", ready: false },
  { href: "#", title: "Zamówienia", text: "Wpłaty klientów, zakup u dostawcy, numery przesyłek, zwroty.", ready: false },
  { href: "#", title: "Łowca perełek", text: "Najkorzystniejsze ceny na Allegro, sezonowość, aktualizacja cen.", ready: false },
];

export default async function AdminHome() {
  await requireAdmin();
  return (
    <>
      <AdminHeader title="Start" />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            aria-disabled={!t.ready}
            className={`rounded-2xl border border-line bg-panel p-5 transition ${t.ready ? "hover:border-gold" : "pointer-events-none opacity-50"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.title}</h2>
              {!t.ready && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">wkrótce</span>}
            </div>
            <p className="mt-2 text-sm text-muted">{t.text}</p>
          </Link>
        ))}
      </main>
    </>
  );
}
