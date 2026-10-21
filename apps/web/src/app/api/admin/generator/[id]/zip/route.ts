import { isAdmin } from "@/lib/auth";
import { getJob } from "@/lib/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Brak dostępu", { status: 401 });
  const pack = getJob((await params).id)?.pack;
  if (!pack) return new Response("Brak paczki", { status: 404 });
  return new Response(new Uint8Array(pack.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.slug}.zip"`,
    },
  });
}
