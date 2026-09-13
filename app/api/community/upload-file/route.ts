import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadCommunityFile } from "@/lib/storage";
import { sendCommunityMessage } from "@/lib/community";

// Body: { dataUrl, fileName } — file APAPUN (zip, pdf, apk, dll), maks 3MB.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  try {
    const { dataUrl, fileName } = await req.json();
    if (!dataUrl) return Response.json({ error: "dataUrl wajib diisi" }, { status: 400 });
    if (!fileName) return Response.json({ error: "fileName wajib diisi" }, { status: 400 });

    const { url, size } = await uploadCommunityFile(login, dataUrl, fileName);
    const message = await sendCommunityMessage({
      login,
      avatarUrl: avatar,
      type: "file",
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
