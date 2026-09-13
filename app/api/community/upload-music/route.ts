import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadCommunityAudio } from "@/lib/storage";
import { sendCommunityMessage } from "@/lib/community";

// Body: { dataUrl, fileName } — musik (MP3/WAV/OGG/M4A/WEBM/AAC), maks 3MB.
// Sama polanya kayak /api/community/upload-file, cuma tipe pesannya "audio"
// jadi FE bisa nampilin inline audio player, bukan link download.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  try {
    const { dataUrl, fileName } = await req.json();
    if (!dataUrl) return Response.json({ error: "dataUrl wajib diisi" }, { status: 400 });

    const { url, size } = await uploadCommunityAudio(login, dataUrl, fileName);
    const message = await sendCommunityMessage({
      login,
      avatarUrl: avatar,
      type: "audio",
      content: url,
      fileName,
      fileSize: size,
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
