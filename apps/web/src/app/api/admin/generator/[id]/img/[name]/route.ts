import { isAdmin } from "@/lib/auth";
import { getJob, imageName } from "@/lib/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  if (!(await isAdmin())) return new Response("Brak dostępu", { status: 401 });
  const { id, name } = await params;
  const img = getJob(id)?.pack?.images.find((i) => imageName(i.series, i.kind) === name);
  if (!img) return new Response("Brak zdjęcia", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `inline; filename="${img.fileName}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
