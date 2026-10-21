import Link from "next/link";
import { logout } from "@/lib/actions";

export function AdminHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/admin" className="font-bold tracking-tight">
          revion<span className="text-gold">.panel</span>
        </Link>
        <span className="text-muted">/</span>
        <span className="text-sm text-muted">{title}</span>
        <form action={logout} className="ml-auto">
          <button className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-line hover:text-white">Wyloguj</button>
        </form>
      </div>
    </header>
  );
}
