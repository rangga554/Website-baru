import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listActivityLogs } from "@/lib/auditLog";

// SENGAJA owner-only (bukan isOwnerOrAdmin) — logs ini justru buat OWNER
// mantau aksi yang dilakuin admin, jadi admin gak perlu (dan gak dikasih)
// akses buat baca ini.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa lihat activity logs" }, { status: 403 });
  }

  try {
    const data = await listActivityLogs(150);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
