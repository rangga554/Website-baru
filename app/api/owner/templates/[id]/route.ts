import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAction } from "@/lib/auditLog";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa hapus Template" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("templates").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  logAction(login, "template.delete", params.id);
  return Response.json({ ok: true });
}
