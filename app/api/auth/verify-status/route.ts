import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findById } from "@/lib/localAccounts";
import { getGithubAccountEmail } from "@/lib/githubAccountEmail";

// Sengaja dipisah dari session/JWT — session token cuma di-refresh pas
// sign-in awal / update() manual, jadi bisa "telat" nyeriminin status
// asli. Endpoint ini SELALU query langsung ke database, biar halaman
// /verify-email gak salah nampilin form (misal nyuruh masukin kode padahal
// akun GitHub-nya belum ada email yang didaftarin sama sekali).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Belum login." }, { status: 401 });

  const accountType = (session as any).accountType as "local" | "github";

  if (accountType === "local") {
    const localId = (session as any).localId as string;
    const acc = localId ? await findById(localId) : null;
    return Response.json({
      accountType: "local",
      email: acc?.email || null,
      emailVerified: !!acc?.email_verified,
      hasEmail: !!acc,
    });
  }

  const githubLogin = (session as any).login as string;
  const rec = githubLogin ? await getGithubAccountEmail(githubLogin) : null;
  return Response.json({
    accountType: "github",
    email: rec?.email || null,
    emailVerified: !!rec?.email_verified,
    hasEmail: !!rec,
  });
}
