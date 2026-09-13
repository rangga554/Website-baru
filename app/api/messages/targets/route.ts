import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMessageTargets } from "@/lib/messages";

// GET -> daftar owner + admin yang bisa dipilih user buat mulai obrolan.
// Owner/admin sendiri gak butuh ini (mereka gak bisa mulai obrolan), tapi
// endpoint-nya tetap boleh diakses siapa aja yang login, gak perlu dicek
// role di sini — pembatasan "gak bisa mulai obrolan" ditegakkan di
// POST /api/messages/conversations, bukan di sini.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const targets = await listMessageTargets();
    return Response.json({ targets });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
