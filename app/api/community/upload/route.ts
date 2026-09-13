import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { uploadCommunityImage } from "@/lib/storage";
import { sendCommunityMessage } from "@/lib/community";

// Body: { dataUrl } — base64 data URL dari <input type="file">.
// Sekalian ngirim pesan bertipe 'image' (jadi FE cuma perlu 1x call),
// termasuk kena rate limit 50 pesan/30 menit yang sama kayak pesan teks.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { dataUrl } = await req.json();
    if (!dataUrl) return Response.json({ error: "dataUrl wajib diisi" }, { status: 400 });

    const url = await uploadCommunityImage(identity.id, dataUrl);
    const message = await sendCommunityMessage({
      login: identity.id,
      avatarUrl: identity.avatarUrl,
      type: "image",
      content: url,
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
