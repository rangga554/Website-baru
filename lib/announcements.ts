import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan buat fitur /announcement (jalankan sekali
// di SQL Editor Supabase):
//
// create table announcements (
//   id uuid primary key default gen_random_uuid(),
//   title text not null,
//   content text not null,
//   created_by text not null,
//   avatar_url text,
//   created_at timestamptz not null default now()
// );
// create index announcements_created_idx on announcements (created_at desc);
//
// create table announcement_comments (
//   id uuid primary key default gen_random_uuid(),
//   announcement_id uuid not null references announcements(id) on delete cascade,
//   login text not null,
//   avatar_url text,
//   content text not null,
//   created_at timestamptz not null default now()
// );
// create index announcement_comments_ann_idx on announcement_comments (announcement_id, created_at);
//
// create table announcement_meta (
//   key text primary key,
//   value text
// );
//
// CATATAN: yang di-reset tiap 45 menit cuma KOMENTARNYA (announcement_comments),
// announcement-nya sendiri (judul & isi pengumuman) TETAP PERMANEN, gak
// pernah kehapus otomatis.
// ============================================================================

const ANN_TABLE = "announcements";
const COMMENT_TABLE = "announcement_comments";
const META_TABLE = "announcement_meta";
const META_KEY = "last_comment_reset";

const RESET_WINDOW_MS = 45 * 60 * 1000; // 45 menit

// Sama kayak ensureCommunityReset — dicek pas ada aktivitas, gak pakai cron.
// Yang dihapus CUMA tabel komentar, bukan tabel announcements.
export async function ensureCommentReset(): Promise<{ resetAt: string }> {
  const supabase = getSupabaseAdmin();

  const { data: meta } = await supabase
    .from(META_TABLE)
    .select("value")
    .eq("key", META_KEY)
    .maybeSingle();

  const lastReset = meta?.value ? new Date(meta.value).getTime() : 0;
  const now = Date.now();

  if (now - lastReset >= RESET_WINDOW_MS) {
    await supabase.from(COMMENT_TABLE).delete().gte("created_at", "1970-01-01");
    const newResetAt = new Date(now).toISOString();
    await supabase.from(META_TABLE).upsert({ key: META_KEY, value: newResetAt });
    return { resetAt: newResetAt };
  }

  return { resetAt: new Date(lastReset).toISOString() };
}

export async function listAnnouncements() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ANN_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal ambil pengumuman: ${error.message}`);
  return data || [];
}

export async function createAnnouncement(params: {
  title: string;
  content: string;
  createdBy: string;
  avatarUrl: string | null;
}) {
  const title = params.title.trim();
  const content = params.content.trim();
  if (!title || !content) throw new Error("Judul dan isi pengumuman wajib diisi");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(ANN_TABLE)
    .insert({
      title,
      content,
      created_by: params.createdBy,
      avatar_url: params.avatarUrl,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal membuat pengumuman: ${error.message}`);
  return data;
}

export async function deleteAnnouncement(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(ANN_TABLE).delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus pengumuman: ${error.message}`);
}

export async function getCommentsForAnnouncement(announcementId: string) {
  const { resetAt } = await ensureCommentReset();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(COMMENT_TABLE)
    .select("*")
    .eq("announcement_id", announcementId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal ambil komentar: ${error.message}`);

  return {
    resetAt,
    nextResetAt: new Date(new Date(resetAt).getTime() + RESET_WINDOW_MS).toISOString(),
    comments: data || [],
  };
}

export async function addComment(params: {
  announcementId: string;
  login: string;
  avatarUrl: string | null;
  content: string;
}) {
  await ensureCommentReset();
  const content = params.content.trim();
  if (!content) throw new Error("Komentar gak boleh kosong");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(COMMENT_TABLE)
    .insert({
      announcement_id: params.announcementId,
      login: params.login,
      avatar_url: params.avatarUrl,
      content,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal mengirim komentar: ${error.message}`);
  return data;
}
