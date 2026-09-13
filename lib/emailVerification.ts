import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { isBrevoConfigured, sendVerificationEmail } from "./brevoEmail";

// ============================================================================
// Token + kode 6 digit verifikasi email — dipakai bareng buat 2 jenis akun
// (local_accounts & github_account_emails), dibedain lewat target_type.
// Token dipakai buat link klik-langsung di email, kode 6 digit buat yang
// mau ngetik manual (kalau buka email di HP lain / gak bisa klik link).
// ============================================================================

const TABLE = "email_verifications";
const EXPIRY_MINUTES = 30;
// Rate limit sederhana: jangan kirim kode baru kalau yang lama belum lewat
// 60 detik, biar gak dipakai buat spam Brevo & inbox orang.
const RESEND_COOLDOWN_MS = 60_000;

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function issueVerification(params: {
  targetType: "local" | "github";
  targetId: string;
  email: string;
}) {
  const supabase = getSupabaseAdmin();

  // Cooldown: cek verifikasi terakhir yang masih hidup buat target ini.
  const { data: recent } = await supabase
    .from(TABLE)
    .select("created_at")
    .eq("target_type", params.targetType)
    .eq("target_id", params.targetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("Tunggu sebentar sebelum minta kode baru lagi (maks 1x per menit).");
  }

  const token = generateToken();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();

  const { error } = await supabase.from(TABLE).insert({
    token,
    target_type: params.targetType,
    target_id: params.targetId,
    email: params.email,
    code,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Gagal buat kode verifikasi: ${error.message}`);

  const verifyUrl = `${getBaseUrl()}/verify-email?token=${token}`;

  if (!isBrevoConfigured()) {
    // Belum di-setup di server ini — jangan bikin registrasi gagal total,
    // tapi kasih tau jelas di response API (lihat pemanggil) biar owner
    // sadar perlu setup BREVO_API_KEY.
    console.warn(
      `[emailVerification] BREVO belum di-setup — kode verifikasi buat ${params.email}: ${code} (${verifyUrl})`
    );
    return { sent: false, verifyUrl };
  }

  await sendVerificationEmail({ to: params.email, code, verifyUrl });
  return { sent: true, verifyUrl };
}

export type VerificationResult =
  | { ok: true; targetType: "local" | "github"; targetId: string; email: string }
  | { ok: false; error: string };

async function consumeVerification(
  matcher: (q: ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>) => any
): Promise<VerificationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await matcher(supabase.from(TABLE) as any);

  if (error || !data) return { ok: false, error: "Kode/link verifikasi gak valid." };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Kode/link verifikasi udah kedaluwarsa, minta yang baru ya." };
  }

  await supabase.from(TABLE).delete().eq("token", data.token);

  return { ok: true, targetType: data.target_type, targetId: data.target_id, email: data.email };
}

export async function verifyByToken(token: string): Promise<VerificationResult> {
  return consumeVerification((q) => q.select("*").eq("token", token).maybeSingle());
}

export async function verifyByCode(params: {
  targetType: "local" | "github";
  targetId: string;
  code: string;
}): Promise<VerificationResult> {
  return consumeVerification((q) =>
    q
      .select("*")
      .eq("target_type", params.targetType)
      .eq("target_id", params.targetId)
      .eq("code", params.code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
}
