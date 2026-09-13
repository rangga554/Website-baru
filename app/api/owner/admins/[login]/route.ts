import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { removeAdmin } from "@/lib/admin";
import { logAction } from "@/lib/auditLog";

// SENGAJA pakai isOwner langsung — cabut akses admin cuma boleh dilakukan
// owner (admin gak boleh cabut akses admin lain, apalagi dirinya sendiri).
export async function DELETE(
  req: Request,
  { params }: { params: { login: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa mencabut akses admin" }, { status: 403 });
  }

  try {
    const target = decodeURIComponent(params.login);
    await removeAdmin(target);
    logAction(login, "remove_admin", `Cabut akses admin: ${target}`);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
