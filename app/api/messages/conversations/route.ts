import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMyConversations, startOrGetConversation } from "@/lib/messages";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  try {
    const conversations = await listMyConversations(login);
    return Response.json({ conversations });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST -> mulai (atau buka yang udah ada) obrolan ke 1 owner/admin.
// CUMA boleh dipanggil user biasa — owner/admin ditolak di lib/messages.ts
// (NOT_INITIATOR), sesuai aturan "admin/owner gak bisa mulai obrolan".
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const body = await req.json().catch(() => ({}));
  const targetLogin = String(body.targetLogin || "").trim();
  if (!targetLogin) return Response.json({ error: "targetLogin wajib diisi" }, { status: 400 });

  try {
    const conversation = await startOrGetConversation(login, targetLogin);
    return Response.json({ conversation });
  } catch (e: any) {
    if (e.message === "NOT_INITIATOR") {
      return Response.json(
        { error: "Owner/Admin gak bisa mulai obrolan baru, cuma bisa balas obrolan yang udah ada" },
        { status: 403 }
      );
    }
    if (e.message === "INVALID_TARGET") {
      return Response.json({ error: "Tujuan chat gak valid" }, { status: 400 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
