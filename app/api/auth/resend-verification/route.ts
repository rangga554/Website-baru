import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueVerification } from "@/lib/emailVerification";
import { getGithubAccountEmail } from "@/lib/githubAccountEmail";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Belum login." }, { status: 401 });

  const accountType = (session as any).accountType as "local" | "github";

  try {
    if (accountType === "local") {
      const localId = (session as any).localId as string;
      const email = (session as any).email as string;
      if (!localId || !email) {
        return Response.json({ error: "Akun lokal gak valid." }, { status: 400 });
      }
      const result = await issueVerification({ targetType: "local", targetId: localId, email });
      return Response.json({ ok: true, emailSent: result.sent });
    }

    const githubLogin = (session as any).login as string;
    if (!githubLogin) return Response.json({ error: "Sesi gak valid." }, { status: 400 });

    const rec = await getGithubAccountEmail(githubLogin);
    if (!rec) {
      return Response.json(
        { error: "Belum ada email yang dihubungkan ke akun ini. Isi dulu email-nya." },
        { status: 400 }
      );
    }
    const result = await issueVerification({ targetType: "github", targetId: githubLogin, email: rec.email });
    return Response.json({ ok: true, emailSent: result.sent });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal kirim ulang kode." }, { status: 400 });
  }
}
