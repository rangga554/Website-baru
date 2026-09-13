import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConversationForParticipant, listMessages, sendMessage } from "@/lib/messages";
import { sendPushToUser } from "@/lib/push";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const conversation = await getConversationForParticipant(params.id, login);
  if (!conversation) return Response.json({ error: "Obrolan gak ketemu" }, { status: 404 });

  try {
    const messages = await listMessages(params.id);
    return Response.json({ conversation, messages });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST -> kirim pesan. Peserta obrolan APA AJA boleh kirim (user maupun
// owner/admin) — pembatasan "gak bisa MULAI obrolan" itu udah ditegakkan
// di endpoint bikin conversation (POST /api/messages/conversations), jadi
// begitu sebuah obrolan udah ADA, kedua pihak setara buat balas-balasan.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const conversation = await getConversationForParticipant(params.id, login);
  if (!conversation) return Response.json({ error: "Obrolan gak ketemu" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || "");

  try {
    const message = await sendMessage(params.id, login, content);

    // Notif ke LAWAN bicara (bukan ke diri sendiri) — best-effort, gagal
    // kirim notif gak boleh bikin pengiriman pesannya sendiri ikut gagal.
    const otherLogin =
      conversation.user_login === login.toLowerCase()
        ? conversation.admin_login
        : conversation.user_login;
    sendPushToUser(otherLogin, {
      title: `Pesan baru dari ${login}`,
      body: content.slice(0, 120),
      url: `/messages/${params.id}`,
    }).catch(() => {});

    return Response.json({ message });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
