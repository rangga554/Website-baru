import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { deleteSocialLink } from "@/lib/socialLinks";
import { logAction } from "@/lib/auditLog";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa hapus link media sosial" }, { status: 403 });
  }

  try {
    await deleteSocialLink(params.id);
    logAction(login, "delete_social_link", `Hapus link media sosial (id: ${params.id})`);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
