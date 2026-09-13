import { getSupabaseAdmin } from "./supabase";

const TABLE = "social_links";

export async function listSocialLinks() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal ambil daftar media sosial: ${error.message}`);
  return data || [];
}

export async function createSocialLink(params: {
  title: string;
  description: string | null;
  url: string;
  createdBy: string;
}) {
  const title = params.title.trim();
  const url = params.url.trim();
  if (!title) throw new Error("Judul wajib diisi");
  if (!url) throw new Error("Link wajib diisi");
  try {
    new URL(url);
  } catch {
    throw new Error("Format link gak valid (harus URL lengkap, contoh: https://tiktok.com/@akun)");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title,
      description: params.description?.trim() || null,
      url,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah media sosial: ${error.message}`);
  return data;
}

export async function deleteSocialLink(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus media sosial: ${error.message}`);
}
