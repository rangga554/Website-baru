import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getCommunityMessages, sendCommunityMessage } from "@/lib/community";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getCommunityMessages();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { type: 'text' | 'image', content }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const message = await sendCommunityMessage({
      login: identity.id,
      avatarUrl: identity.avatarUrl,
      type: body.type === "image" ? "image" : "text",
      content: body.content || "",
    });
    return Response.json(message);
  } catch (e: any) {
    if (e.message === "RATE_LIMITED") {
      return Response.json(
        { error: "Kamu udah kirim 50 pesan di sesi ini. Tunggu chat di-reset (siklus 30 menit)." },
        { status: 429 }
      );
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
