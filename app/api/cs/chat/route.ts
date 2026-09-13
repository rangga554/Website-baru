import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCustomerServiceReply } from "@/lib/groq";
import { listAnnouncements } from "@/lib/announcements";

// Body: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  // Validasi ringan biar gak disalahgunakan buat inject role/system palsu
  const messages = body.messages
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (messages.length === 0) {
    return Response.json({ error: "Pesan kosong" }, { status: 400 });
  }

  // Kasih tau CS 3 pengumuman terbaru, biar bisa jawab kalau user nanya
  // "ada update apa" / "fitur baru apa" tanpa perlu di-hardcode manual.
  let recentUpdates = "";
  try {
    const announcements = await listAnnouncements();
    recentUpdates = announcements
      .slice(0, 3)
      .map((a: any) => `- ${a.title}: ${a.content.slice(0, 200)}`)
      .join("\n");
  } catch {
    // Kalau gagal ambil (misal Supabase lagi bermasalah), CS tetap jalan
    // tanpa info update — gak kritis.
  }

  try {
    const reply = await getCustomerServiceReply(messages, recentUpdates || undefined);
    return Response.json({ reply });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
