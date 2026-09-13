import { verifyLinkState } from "@/lib/linkState";
import { linkGithubAccount } from "@/lib/localAccounts";
import { saveGithubToken } from "@/lib/collaboration";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.NEXTAUTH_URL || url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const fail = (msg: string) => Response.redirect(`${base}/settings?linkError=${encodeURIComponent(msg)}`);

  if (!code || !state) return fail("Callback GitHub gak lengkap.");

  const verified = verifyLinkState(state);
  if (!verified) return fail("Sesi penautan udah kedaluwarsa, coba lagi.");

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_ID,
        client_secret: process.env.GITHUB_SECRET,
        code,
        redirect_uri: `${base}/api/auth/link-github/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return fail("Gagal tukar kode GitHub jadi token.");

    const userRes = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const ghUser = await userRes.json();
    const githubLogin = ghUser?.login;
    if (!githubLogin) return fail("Gagal ambil profil GitHub.");

    await linkGithubAccount(verified.localAccountId, githubLogin);

    // Simpen token-nya juga, biar fitur GitHub (editor/repo) langsung bisa
    // dipakai di sesi lokal ini tanpa perlu login GitHub OAuth lagi terpisah
    // (lihat lib/auth.ts jwt callback bagian "pinjam token").
    try {
      await saveGithubToken(githubLogin, accessToken);
    } catch {
      // Diem-diem aja kalau gagal simpan — penautan tetap berhasil, cuma
      // fitur GitHub yang belum langsung aktif sampai user login GitHub
      // sendiri minimal sekali.
    }

    return Response.redirect(`${base}/settings?linked=1`);
  } catch (e: any) {
    return fail(e.message || "Gagal menautkan akun GitHub.");
  }
}
