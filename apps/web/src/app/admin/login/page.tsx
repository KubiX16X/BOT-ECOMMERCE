import { redirect } from "next/navigation";
import { login } from "@/lib/actions";
import { adminPassword, isAdmin } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ blad?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { blad } = await searchParams;
  const configured = !!adminPassword();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={login} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <h1 className="text-xl font-bold">
          revion<span className="text-gold">.panel</span>
        </h1>
        {configured ? (
          <>
            <label className="mt-6 block text-sm text-muted" htmlFor="password">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-gold"
            />
            {blad && <p className="mt-2 text-sm text-red-400">Złe hasło.</p>}
            <button className="mt-5 w-full rounded-lg bg-gold py-2 font-semibold text-ink hover:bg-gold-dark">Zaloguj</button>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Panel jest wyłączony. Ustaw <code className="text-gold">ADMIN_PASSWORD</code> w pliku .env i uruchom serwer ponownie.
          </p>
        )}
      </form>
    </main>
  );
}
