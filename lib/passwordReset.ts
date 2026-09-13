import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase";
import { isBrevoConfigured, sendPasswordResetEmail } from "./brevoEmail";
import { findByUsernameOrEmail, validatePassword, type LocalAccount } from "./localAccounts";

// ============================================================================
// LUPA PASSWORD — khusus akun lokal (username/password), akun GitHub gak
// punya password yang dikelola KRYNOS jadi gak relevan di sini.
//
// PENTING: alur ini SENGAJA gak nulis apapun ke security_notifications
// (beda dari ganti password manual di Settings, lihat lib/securityNotifications.ts)
// — sesuai permintaan, "lupa password" dikecualikan dari notifikasi.
// ============================================================================

const TABLE = "password_resets";
const EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_MS = 60_000; // sama kayak verifikasi email, cegah spam Brevo

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

// Selalu balikin hasil yang GENERIK di API layer (jangan bocorin apakah
// email/username-nya kedaftar atau nggak) — ini cuma internal, boleh throw
// buat rate-limit doang.
export async function requestPasswordReset(identifier: string): Promise<void> {
  const account = await findByUsernameOrEmail(identifier);
  if (!account || account.status === "banned") return; // diem-diem aja, gak throw (cegah user enumeration)

  const supabase = getSupabaseAdmin();

  const { data: recent } = await supabase
    .from(TABLE)
    .select("created_at")
    .eq("local_account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("Tunggu sebentar sebelum minta reset lagi (maks 1x per menit).");
  }

  // Token lama (kalau ada) dianggap gak berlaku lagi begitu ada request baru
  // — cuma link/kode PALING BARU yang valid.
  await supabase.from(TABLE).delete().eq("local_account_id", account.id);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();
  const { error } = await supabase
    .from(TABLE)
    .insert({ token, local_account_id: account.id, expires_at: expiresAt });
  if (error) throw new Error(`Gagal buat token reset: ${error.message}`);

  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;

  if (!isBrevoConfigured()) {
    console.warn(`[passwordReset] BREVO belum di-setup — link reset buat ${account.email}: ${resetUrl}`);
    return;
  }
  await sendPasswordResetEmail({ to: account.email, resetUrl });
}

export async function validateResetToken(
  token: string
): Promise<{ valid: boolean; account?: LocalAccount }> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from(TABLE).select("*").eq("token", token).maybeSingle();
  if (!data) return { valid: false };
  if (new Date(data.expires_at).getTime() < Date.now()) return { valid: false };

  const { findById } = await import("./localAccounts");
  const account = await findById(data.local_account_id);
  if (!account) return { valid: false };
  return { valid: true, account };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const { valid, account } = await validateResetToken(token);
  if (!valid || !account) throw new Error("Link/token reset gak valid atau udah kedaluwarsa.");

  const passErr = validatePassword(newPassword);
  if (passErr) throw new Error(passErr);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("local_accounts")
    .update({ password_hash: passwordHash })
    .eq("id", account.id);
  if (error) throw new Error(`Gagal reset password: ${error.message}`);

  // Semua token reset buat akun ini dianggap kepakai/gugur (jaga-jaga kalau
  // ada beberapa token aktif barengan).
  await supabase.from(TABLE).delete().eq("local_account_id", account.id);

  // SENGAJA gak manggil recordSecurityNotification() di sini — lihat
  // catatan di header file.
}
