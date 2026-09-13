import { getSupabaseAdmin } from "./supabase";
import { isOwner } from "./owner";

// ============================================================================
// Tambahan kolom di tabel user_activity — lihat supabase_schema.txt bagian
// "OWNER STATS" (kolom banned/banned_reason/banned_at).
//
// CATATAN: "hapus user" di sini cuma ngapus RECORD TRACKING-nya (baris di
// user_activity) — BUKAN ngapus akun GitHub orangnya. Setelah dihapus, kalau
// dia login lagi, bakal ke-track ulang dari nol (first_seen baru).
// "Ban" nge-block login BARU (dicek di lib/auth.ts signIn callback) dan
// nendang user yang lagi login pas di-ban ke halaman /banned (dicek dari
// Dashboard lewat /api/me/status).
// ============================================================================

const TABLE = "user_activity";

export type ManagedUser = {
  login: string;
  avatar_url: string | null;
  first_seen: string;
  last_seen: string;
  total_active_seconds: number;
  banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
};

export async function listUsers(): Promise<ManagedUser[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("login, avatar_url, first_seen, last_seen, total_active_seconds, banned, banned_reason, banned_at")
    .order("last_seen", { ascending: false });
  if (error) throw new Error(`Gagal ambil daftar user: ${error.message}`);
  return (data || []) as ManagedUser[];
}

export async function banUser(login: string, reason: string | null) {
  if (isOwner(login)) throw new Error("Gak bisa ban akun owner sendiri");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ banned: true, banned_reason: reason, banned_at: new Date().toISOString() })
    .eq("login", login);
  if (error) throw new Error(`Gagal ban user: ${error.message}`);
}

export async function unbanUser(login: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .update({ banned: false, banned_reason: null, banned_at: null })
    .eq("login", login);
  if (error) throw new Error(`Gagal unban user: ${error.message}`);
}

export async function deleteUserRecord(login: string) {
  if (isOwner(login)) throw new Error("Gak bisa hapus akun owner sendiri");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("login", login);
  if (error) throw new Error(`Gagal hapus user: ${error.message}`);
}

// Dipanggil dari signIn callback (lib/auth.ts) & route yang butuh proteksi.
// Gagal-terbuka (return false / gak nge-throw) kalau Supabase belum
// disetup, biar fitur ban gak bikin SELURUH app gak bisa dipakai kalau
// owner belum jalanin migrasi kolom banned.
export async function isUserBanned(login: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select("banned")
      .eq("login", login)
      .maybeSingle();
    if (error || !data) return false;
    return !!data.banned;
  } catch {
    return false;
  }
}

// Dipanggil dari halaman /banned buat nampilin alasan ban ke user. Sama
// kayak isUserBanned, gagal-terbuka (banned: false) kalau ada masalah.
export type BanInfo = { banned: boolean; reason: string | null; bannedAt: string | null };

export async function getBanInfo(login: string): Promise<BanInfo> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select("banned, banned_reason, banned_at")
      .eq("login", login)
      .maybeSingle();
    if (error || !data) return { banned: false, reason: null, bannedAt: null };
    return {
      banned: !!data.banned,
      reason: data.banned_reason || null,
      bannedAt: data.banned_at || null,
    };
  } catch {
    return { banned: false, reason: null, bannedAt: null };
  }
}
