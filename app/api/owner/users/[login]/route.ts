import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { banUser, unbanUser, deleteUserRecord } from "@/lib/userManagement";
import { logAction } from "@/lib/auditLog";

async function assertAllowed(session: any) {
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const login = session.login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return { error: "Cuma owner/admin yang bisa kelola user", status: 403 as const };
  }
  return null;
}

// Body: { action: "ban" | "unban", reason?: string }
export async function PATCH(
  req: Request,
  { params }: { params: { login: string } }
) {
  const session = await getServerSession(authOptions);
  const denied = await assertAllowed(session);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status });

  try {
    const body = await req.json().catch(() => ({}));
    const target = decodeURIComponent(params.login);
    const actor = (session as any).login as string;

    if (body.action === "ban") {
      await banUser(target, body.reason || null);
      logAction(actor, "ban_user", `Ban ${target}${body.reason ? ` (alasan: ${body.reason})` : ""}`);
    } else if (body.action === "unban") {
      await unbanUser(target);
      logAction(actor, "unban_user", `Unban ${target}`);
    } else {
      return Response.json({ error: "action harus 'ban' atau 'unban'" }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { login: string } }
) {
  const session = await getServerSession(authOptions);
  const denied = await assertAllowed(session);
  if (denied) return Response.json({ error: denied.error }, { status: denied.status });

  try {
    const target = decodeURIComponent(params.login);
    await deleteUserRecord(target);
    logAction((session as any).login, "delete_user_record", `Hapus tracking ${target}`);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
