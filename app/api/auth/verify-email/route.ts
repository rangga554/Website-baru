import { verifyByToken, verifyByCode, VerificationResult } from "@/lib/emailVerification";
import { markEmailVerified } from "@/lib/localAccounts";
import { markGithubEmailVerified } from "@/lib/githubAccountEmail";

async function applyResult(result: VerificationResult): Promise<VerificationResult> {
  if (result.ok === false) return result;
  if (result.targetType === "local") {
    await markEmailVerified(result.targetId);
  } else {
    await markGithubEmailVerified(result.targetId);
  }
  return result;
}

// Diklik dari link di email — redirect ke halaman /verify-email dengan status.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const base = process.env.NEXTAUTH_URL || url.origin;

  if (!token) {
    return Response.redirect(`${base}/verify-email?status=error&msg=Token%20gak%20ada`);
  }

  const result = await applyResult(await verifyByToken(token));
  if (result.ok === false) {
    return Response.redirect(`${base}/verify-email?status=error&msg=${encodeURIComponent(result.error)}`);
  }
  return Response.redirect(`${base}/verify-email?status=success`);
}

// Dipakai kalau user ngetik manual 6-digit code (butuh tau targetType/targetId
// -> dikirim dari client berdasarkan session yang lagi login).
export async function POST(req: Request) {
  try {
    const { targetType, targetId, code } = await req.json();
    if (!targetType || !targetId || !code) {
      return Response.json({ error: "Data verifikasi gak lengkap." }, { status: 400 });
    }

    const result = await applyResult(await verifyByCode({ targetType, targetId, code }));
    if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal verifikasi." }, { status: 500 });
  }
}
