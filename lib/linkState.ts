import crypto from "crypto";

// State buat flow "Tautkan akun GitHub" (dipanggil pas user login pakai akun
// lokal, terus klik "Tautkan GitHub" di Settings). Sengaja stateless (signed
// pakai NEXTAUTH_SECRET), gak butuh tabel/DB tambahan cuma buat nyimpen 1
// nilai sementara ini.

const EXPIRY_MS = 10 * 60_000; // 10 menit, cukup buat proses OAuth GitHub

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET belum di-set.");
  return secret;
}

export function signLinkState(localAccountId: string): string {
  const payload = JSON.stringify({ id: localAccountId, exp: Date.now() + EXPIRY_MS });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyLinkState(state: string): { localAccountId: string } | null {
  try {
    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) return null;

    const expectedSig = crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
    if (sig !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload?.id || Date.now() > payload.exp) return null;

    return { localAccountId: payload.id };
  } catch {
    return null;
  }
}
