import { getSupabaseAdmin } from "./supabase";
import { isOwner } from "./owner";
import { isDeveloper } from "./developer";

// ============================================================================
// Tabel Supabase yang dibutuhkan — lihat supabase_schema.txt bagian
// "ADMIN (dikelola owner)":
//
// create table app_admins (
//   login text primary key,
//   added_by text not null,
//   created_at timestamptz not null default now()
// );
//
// Admin = user tambahan yang owner kasih akses ke Owner/Admin Panel (moderasi
// user, konten, dll) — TAPI gak bisa apa-apain akun OWNER sendiri (ban/unban/
// hapus target owner selalu ditolak, lihat lib/userManagement.ts), dan gak
// bisa nambah/hapus admin lain (itu HAK EKSKLUSIF owner, dicek pakai isOwner
// langsung, bukan isOwnerOrAdmin, di route /api/owner/admins/*).
// ============================================================================

const TABLE = "app_admins";

export type AdminRow = {
  login: string;
  added_by: string;
  created_at: string;
};

// Gagal-terbuka (false) kalau Supabase/tabel belum disetup, biar fitur admin
// gak bikin app owner sendiri jadi gak bisa dipakai.
export async function isAdmin(login?: string | null): Promise<boolean> {
  if (!login) return false;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(TABLE)
      .select("login")
      .eq("login", login.toLowerCase())
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

// Helper gabungan yang paling sering dipakai: owner ATAU admin.
export async function isOwnerOrAdmin(login?: string | null): Promise<boolean> {
  if (isOwner(login)) return true;
  if (await isAdmin(login)) return true;
  return isDeveloper(login);
}

export async function listAdmins(): Promise<AdminRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("login, added_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal ambil daftar admin: ${error.message}`);
  return data || [];
}

export async function addAdmin(login: string, addedBy: string) {
  const clean = login.trim().toLowerCase();
  if (!clean) throw new Error("Username wajib diisi");
  if (isOwner(clean)) throw new Error("Owner otomatis punya akses penuh, gak perlu ditambah jadi admin");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ login: clean, added_by: addedBy });
  if (error) throw new Error(`Gagal menambah admin: ${error.message}`);
}

export async function removeAdmin(login: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("login", login.toLowerCase());
  if (error) throw new Error(`Gagal menghapus admin: ${error.message}`);
}
