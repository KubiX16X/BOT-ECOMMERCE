import { isAdmin } from "@/lib/auth";
import { getJob, jobView } from "@/lib/jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Brak dostępu" }, { status: 401 });
  const job = getJob((await params).id);
  if (!job) return Response.json({ error: "Nie ma takiego zadania (serwer mógł zostać zrestartowany)." }, { status: 404 });
  return Response.json(jobView(job));
}
