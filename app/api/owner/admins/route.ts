import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listAdmins, addAdmin } from "@/lib/admin";
import { logAction } from "@/lib/auditLog";

// SENGAJA pakai isOwner langsung (BUKAN isOwnerOrAdmin) di seluruh file ini
// — nambah/hapus admin adalah hak eksklusif owner, admin gak boleh nambah
// admin lain (apalagi nambah dirinya sendiri balik kalau di-cabut).

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa lihat daftar admin" }, { status: 403 });
  }

  try {
    const data = await listAdmins();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { login }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa menambah admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.login) return Response.json({ error: "Username wajib diisi" }, { status: 400 });

  try {
    await addAdmin(body.login, login);
    logAction(login, "add_admin", `Tambah admin: ${body.login}`);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
