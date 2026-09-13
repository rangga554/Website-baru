import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setGithubAccountEmail } from "@/lib/githubAccountEmail";
import { validateEmail } from "@/lib/localAccounts";
import { issueVerification } from "@/lib/emailVerification";

// Khusus akun GitHub (termasuk akun LAMA) yang belum punya email terhubung
// sama sekali di app ini — dipakai di halaman /verify-email buat isi email
// pertama kali sebelum bisa lanjut minta kode verifikasi.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session as any).accountType !== "github") {
    return Response.json({ error: "Cuma buat akun GitHub." }, { status: 401 });
  }

  const githubLogin = (session as any).login as string;
  if (!githubLogin) return Response.json({ error: "Sesi gak valid." }, { status: 400 });

  try {
    const { email } = await req.json();
    const err = validateEmail(email || "");
    if (err) return Response.json({ error: err }, { status: 400 });

    await setGithubAccountEmail(githubLogin, email);
    const result = await issueVerification({ targetType: "github", targetId: githubLogin, email });

    return Response.json({ ok: true, emailSent: result.sent });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal hubungkan email." }, { status: 400 });
  }
}
