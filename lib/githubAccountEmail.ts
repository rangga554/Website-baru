import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Email yang ditautkan ke akun GitHub. Akun GitHub gak punya kolom email di
// app ini sebelumnya, jadi ini tabel terpisah — dipakai buat nge-gate akses
// (akun GitHub, termasuk yang LAMA/udah terdaftar dari dulu, WAJIB nautkan +
// verifikasi email sebelum bisa pakai KRYNOS). Lihat supabase_schema.txt
// bagian 13.
// ============================================================================

const TABLE = "github_account_emails";

export type GithubAccountEmail = {
  github_login: string;
  email: string;
  email_lower: string;
  email_verified: boolean;
  created_at: string;
};

export async function getGithubAccountEmail(githubLogin: string): Promise<GithubAccountEmail | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("github_login", githubLogin.toLowerCase())
    .maybeSingle();
  return (data as GithubAccountEmail) || null;
}

// Dipanggil pas user (yang login GitHub, tapi belum ada/belum verified email)
// isi form "Hubungkan email" di /verify-email. Upsert, belum verified sampai
// kode dimasukin.
export async function setGithubAccountEmail(githubLogin: string, email: string) {
  const supabase = getSupabaseAdmin();

  // Email yang SUDAH terverifikasi di akun lain gak boleh dipakai ulang di
  // sini (baik akun GitHub lain maupun akun lokal).
  const { data: takenGithub } = await supabase
    .from(TABLE)
    .select("github_login")
    .eq("email_lower", email.toLowerCase())
    .eq("email_verified", true)
    .maybeSingle();
  if (takenGithub && takenGithub.github_login !== githubLogin.toLowerCase()) {
    throw new Error("Email ini udah terverifikasi & terpakai di akun lain.");
  }

  const { error } = await supabase.from(TABLE).upsert({
    github_login: githubLogin.toLowerCase(),
    email,
    email_lower: email.toLowerCase(),
    email_verified: false,
  });
  if (error) throw new Error(`Gagal simpan email: ${error.message}`);
}

export async function markGithubEmailVerified(githubLogin: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ email_verified: true })
    .eq("github_login", githubLogin.toLowerCase());
  if (error) throw new Error(`Gagal update status verifikasi: ${error.message}`);
}
