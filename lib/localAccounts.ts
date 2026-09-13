import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Akun lokal (username/password/email) — BERDAMPINGAN sama login GitHub,
// bukan pengganti. Lihat supabase_schema.txt bagian 13 buat skema tabelnya.
//
// Status akun:
//   'pending' -> baru daftar, belum verifikasi email -> BELUM boleh akses
//                KRYNOS sama sekali (dicek di lib/auth.ts + middleware).
//   'active'  -> email udah diverifikasi, akses normal.
//   'banned'  -> diblokir (reuse mekanisme sama kayak userManagement.ts).
// ============================================================================

const TABLE = "local_accounts";

export type LocalAccount = {
  id: string;
  username: string;
  username_lower: string;
  password_hash: string;
  email: string;
  email_lower: string;
  email_verified: boolean;
  status: "pending" | "active" | "banned";
  github_login: string | null;
  created_at: string;
};

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username 3-20 karakter, cuma huruf/angka/underscore/titik.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password minimal 8 karakter.";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Format email gak valid.";
  return null;
}

export async function findByUsername(username: string): Promise<LocalAccount | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("username_lower", username.trim().toLowerCase())
    .maybeSingle();
  return (data as LocalAccount) || null;
}

export async function findByEmail(email: string): Promise<LocalAccount | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("email_lower", email.trim().toLowerCase())
    .maybeSingle();
  return (data as LocalAccount) || null;
}

export async function findById(id: string): Promise<LocalAccount | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  return (data as LocalAccount) || null;
}

// Login bisa pakai username ATAU email (sesuai request: "login bisa pakai
// via email"). Deteksi otomatis: ada "@" -> anggap email.
export async function findByUsernameOrEmail(identifier: string): Promise<LocalAccount | null> {
  const clean = identifier.trim();
  if (clean.includes("@")) return findByEmail(clean);
  return findByUsername(clean);
}

export async function registerLocalAccount(params: {
  username: string;
  email: string;
  password: string;
}): Promise<LocalAccount> {
  const username = params.username.trim();
  const email = params.email.trim();

  const usernameErr = validateUsername(username);
  if (usernameErr) throw new Error(usernameErr);
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const passErr = validatePassword(params.password);
  if (passErr) throw new Error(passErr);

  const existingUsername = await findByUsername(username);
  if (existingUsername) throw new Error("Username udah dipakai orang lain.");

  const existingEmail = await findByEmail(email);
  if (existingEmail) {
    if (existingEmail.email_verified) {
      throw new Error(
        "Email ini udah terpakai & terverifikasi di akun lain. Coba login pakai akun itu."
      );
    }
    // Ada akun pending lama dengan email sama (mungkin ke-abandon sebelum
    // verifikasi) — biar gak numpuk baris nyampah, hapus yang lama.
    const supabase = getSupabaseAdmin();
    await supabase.from(TABLE).delete().eq("id", existingEmail.id);
  }

  const passwordHash = await bcrypt.hash(params.password, 10);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      username,
      username_lower: username.toLowerCase(),
      password_hash: passwordHash,
      email,
      email_lower: email.toLowerCase(),
      email_verified: false,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Gagal daftar: ${error.message}`);
  return data as LocalAccount;
}

export async function verifyPassword(account: LocalAccount, password: string): Promise<boolean> {
  return bcrypt.compare(password, account.password_hash);
}

// Dipakai ganti password MANUAL (dari Settings, user lagi login & tau
// password lama) — beda dari reset lewat lupa password (lib/passwordReset.ts).
export async function updatePassword(accountId: string, newPassword: string) {
  const passErr = validatePassword(newPassword);
  if (passErr) throw new Error(passErr);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ password_hash: passwordHash })
    .eq("id", accountId);
  if (error) throw new Error(`Gagal ganti password: ${error.message}`);
}

export async function markEmailVerified(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ email_verified: true, status: "active" })
    .eq("id", id);
  if (error) throw new Error(`Gagal update status verifikasi: ${error.message}`);
}

export async function linkGithubAccount(localAccountId: string, githubLogin: string) {
  const supabase = getSupabaseAdmin();

  // 1 akun GitHub cuma boleh ditautkan ke 1 akun lokal.
  const { data: already } = await supabase
    .from(TABLE)
    .select("id")
    .eq("github_login", githubLogin.toLowerCase())
    .maybeSingle();
  if (already && already.id !== localAccountId) {
    throw new Error("Akun GitHub ini udah ditautkan ke akun lain.");
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ github_login: githubLogin.toLowerCase() })
    .eq("id", localAccountId);
  if (error) throw new Error(`Gagal tautkan akun GitHub: ${error.message}`);
}

export async function unlinkGithubAccount(localAccountId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ github_login: null })
    .eq("id", localAccountId);
  if (error) throw new Error(`Gagal lepas tautan akun GitHub: ${error.message}`);
}

export async function findByGithubLogin(githubLogin: string): Promise<LocalAccount | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("github_login", githubLogin.toLowerCase())
    .maybeSingle();
  return (data as LocalAccount) || null;
}
