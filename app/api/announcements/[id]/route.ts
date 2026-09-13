import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { deleteAnnouncement } from "@/lib/announcements";
import { logAction } from "@/lib/auditLog";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa menghapus pengumuman" }, { status: 403 });
  }

  try {
    await deleteAnnouncement(params.id);
    logAction(login, "delete_announcement", `Hapus pengumuman (id: ${params.id})`);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
