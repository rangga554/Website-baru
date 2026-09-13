import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConversationForParticipant, endConversation } from "@/lib/messages";
import { isOwnerOrAdmin } from "@/lib/admin";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const conversation = await getConversationForParticipant(params.id, login);
  if (!conversation) return Response.json({ error: "Obrolan gak ketemu" }, { status: 404 });
  return Response.json({ conversation });
}

// DELETE -> "Akhiri Obrolan". CUMA boleh dipanggil owner/admin yang jadi
// tujuan obrolan ini (bukan si user) — ngehapus PERMANEN conversation +
// semua pesannya dari Supabase (reset total, bukan cuma ditandai selesai).
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const conversation = await getConversationForParticipant(params.id, login);
  if (!conversation) return Response.json({ error: "Obrolan gak ketemu" }, { status: 404 });

  if (!(await isOwnerOrAdmin(login))) {
    return Response.json(
      { error: "Cuma Owner/Admin yang bisa mengakhiri obrolan" },
      { status: 403 }
    );
  }

  try {
    await endConversation(params.id);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
