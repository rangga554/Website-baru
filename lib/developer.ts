import { getSupabaseAdmin } from "./supabase";
import { isOwner } from "./owner";

const TABLE = "app_developers";

export type DeveloperRow = {
  login: string;
  added_by: string;
  created_at: string;
};

export async function isDeveloper(login?: string | null): Promise<boolean> {
  if (!login || isOwner(login)) return false;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(TABLE).select("login").eq("login", login.toLowerCase()).maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

export async function listDevelopers(): Promise<DeveloperRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(TABLE).select("login, added_by, created_at").order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal ambil daftar developer: ${error.message}`);
  return data || [];
}

export async function addDeveloper(login: string, addedBy: string) {
  const clean = login.trim().toLowerCase();
  if (!clean) throw new Error("Username wajib diisi");
  if (isOwner(clean)) throw new Error("Owner otomatis punya akses penuh");
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).upsert({ login: clean, added_by: addedBy });
  if (error) throw new Error(`Gagal menambah developer: ${error.message}`);
}

export async function removeDeveloper(login: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("login", login.toLowerCase());
  if (error) throw new Error(`Gagal menghapus developer: ${error.message}`);
}
