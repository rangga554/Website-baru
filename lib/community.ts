import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan buat fitur /komunitas (jalankan sekali di
// SQL Editor Supabase):
//
// create table community_messages (
//   id uuid primary key default gen_random_uuid(),
//   login text not null,
//   avatar_url text,
//   type text not null default 'text', -- 'text' | 'image' | 'file' | 'audio' | 'poll'
//   content text,                       -- isi teks, atau URL gambar/file
//   file_name text,                     -- nama asli file (cuma dipakai kalau type = 'file')
//   file_size integer,                  -- ukuran file dalam byte (cuma dipakai kalau type = 'file')
//   poll_id uuid,
//   created_at timestamptz not null default now()
// );
// create index community_messages_created_idx on community_messages (created_at);
// create index community_messages_login_idx on community_messages (login);
//
// create table community_polls (
//   id uuid primary key default gen_random_uuid(),
//   question text not null,
//   options jsonb not null,       -- [{ "id": "a", "label": "Ya" }, ...]
//   created_by text not null,
//   ends_at timestamptz not null,
//   created_at timestamptz not null default now()
// );
//
// create table community_poll_votes (
//   poll_id uuid not null,
//   login text not null,
//   option_id text not null,
//   created_at timestamptz not null default now(),
//   primary key (poll_id, login)
// );
//
// create table community_meta (
//   key text primary key,
//   value text
// );
//
// Buat upload gambar, bikin juga 1 STORAGE BUCKET (bukan lewat SQL — di
// Supabase Dashboard -> Storage -> New bucket):
//   - Nama: community-uploads
//   - Public bucket: AKTIFKAN (biar gambar bisa langsung ditampilin tanpa
//     signed URL)
// ============================================================================

const MSG_TABLE = "community_messages";
const POLL_TABLE = "community_polls";
const VOTE_TABLE = "community_poll_votes";
const META_TABLE = "community_meta";
const META_KEY = "last_reset";

const RESET_WINDOW_MS = 30 * 60 * 1000; // 30 menit
const MAX_MESSAGES_PER_WINDOW = 50;

// Dicek tiap kali ada yang buka atau kirim chat: kalau udah lewat 30 menit
// sejak reset terakhir, HAPUS SEMUA pesan & polling (buat semua orang),
// terus catat waktu reset baru. Pendekatan "lazy check" ini sengaja dipilih
// biar gak perlu cron job / server terpisah — cukup dicek pas ada aktivitas.
export async function ensureCommunityReset(): Promise<{ resetAt: string }> {
  const supabase = getSupabaseAdmin();

  const { data: meta } = await supabase
    .from(META_TABLE)
    .select("value")
    .eq("key", META_KEY)
    .maybeSingle();

  const lastReset = meta?.value ? new Date(meta.value).getTime() : 0;
  const now = Date.now();

  if (now - lastReset >= RESET_WINDOW_MS) {
    // .gte dengan tanggal jauh di masa lalu = hapus semua row (Supabase
    // butuh filter, gak bisa delete tanpa where clause).
    await supabase.from(MSG_TABLE).delete().gte("created_at", "1970-01-01");
    await supabase.from(VOTE_TABLE).delete().gte("created_at", "1970-01-01");
    await supabase.from(POLL_TABLE).delete().gte("created_at", "1970-01-01");

    const newResetAt = new Date(now).toISOString();
    await supabase.from(META_TABLE).upsert({ key: META_KEY, value: newResetAt });
    return { resetAt: newResetAt };
  }

  return { resetAt: new Date(lastReset).toISOString() };
}

export async function getCommunityMessages(limit = 200) {
  const { resetAt } = await ensureCommunityReset();
  const supabase = getSupabaseAdmin();

  const { data: messages, error } = await supabase
    .from(MSG_TABLE)
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Gagal ambil pesan: ${error.message}`);

  const pollIds = (messages || [])
    .filter((m) => m.type === "poll" && m.poll_id)
    .map((m) => m.poll_id);

  let pollsById: Record<string, any> = {};
  if (pollIds.length > 0) {
    const { data: polls } = await supabase.from(POLL_TABLE).select("*").in("id", pollIds);
    const { data: votes } = await supabase
      .from(VOTE_TABLE)
      .select("poll_id, option_id")
      .in("poll_id", pollIds);

    for (const poll of polls || []) {
      const tally: Record<string, number> = {};
      for (const v of votes || []) {
        if (v.poll_id === poll.id) tally[v.option_id] = (tally[v.option_id] || 0) + 1;
      }
      pollsById[poll.id] = { ...poll, tally };
    }
  }

  return {
    resetAt,
    nextResetAt: new Date(new Date(resetAt).getTime() + RESET_WINDOW_MS).toISOString(),
    messages: (messages || []).map((m) => ({
      ...m,
      poll: m.type === "poll" ? pollsById[m.poll_id] || null : undefined,
    })),
  };
}

export async function sendCommunityMessage(params: {
  login: string;
  avatarUrl: string | null;
  type: "text" | "image" | "file" | "audio";
  content: string;
  fileName?: string;
  fileSize?: number;
}) {
  await ensureCommunityReset();
  const supabase = getSupabaseAdmin();

  const { count, error: countError } = await supabase
    .from(MSG_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("login", params.login);
  if (countError) throw new Error(`Gagal cek kuota pesan: ${countError.message}`);

  if ((count || 0) >= MAX_MESSAGES_PER_WINDOW) {
    throw new Error("RATE_LIMITED");
  }

  const trimmed = params.content.trim();
  if (!trimmed) throw new Error("Pesan gak boleh kosong");

  const { data, error } = await supabase
    .from(MSG_TABLE)
    .insert({
      login: params.login,
      avatar_url: params.avatarUrl,
      type: params.type,
      content: trimmed,
      file_name: params.fileName || null,
      file_size: params.fileSize ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal kirim pesan: ${error.message}`);

  return data;
}

export async function createCommunityPoll(params: {
  question: string;
  options: string[];
  createdBy: string;
  durationSeconds: number;
}) {
  await ensureCommunityReset();
  const supabase = getSupabaseAdmin();

  const question = params.question.trim();
  const cleanOptions = params.options.map((o) => o.trim()).filter(Boolean);
  if (!question) throw new Error("Pertanyaan polling gak boleh kosong");
  if (cleanOptions.length < 2) throw new Error("Minimal 2 opsi polling");
  if (params.durationSeconds < 30) throw new Error("Durasi polling minimal 30 detik");

  const optionObjs = cleanOptions.map((label, i) => ({ id: String(i), label }));
  const endsAt = new Date(Date.now() + params.durationSeconds * 1000).toISOString();

  const { data: poll, error: pollError } = await supabase
    .from(POLL_TABLE)
    .insert({
      question,
      options: optionObjs,
      created_by: params.createdBy,
      ends_at: endsAt,
    })
    .select()
    .single();
  if (pollError) throw new Error(`Gagal membuat polling: ${pollError.message}`);

  const { error: msgError } = await supabase.from(MSG_TABLE).insert({
    login: params.createdBy,
    avatar_url: null,
    type: "poll",
    content: question,
    poll_id: poll.id,
  });
  if (msgError) throw new Error(`Gagal menyematkan polling: ${msgError.message}`);

  return poll;
}

export async function voteCommunityPoll(params: {
  pollId: string;
  login: string;
  optionId: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: poll, error: pollError } = await supabase
    .from(POLL_TABLE)
    .select("ends_at")
    .eq("id", params.pollId)
    .maybeSingle();
  if (pollError || !poll) throw new Error("Polling tidak ditemukan (mungkin udah di-reset)");
  if (new Date(poll.ends_at).getTime() < Date.now()) throw new Error("POLL_ENDED");

  // upsert -> 1 akun cuma bisa vote 1x, vote ulang = ganti pilihan (bukan nambah suara baru)
  const { error } = await supabase.from(VOTE_TABLE).upsert({
    poll_id: params.pollId,
    login: params.login,
    option_id: params.optionId,
  });
  if (error) throw new Error(`Gagal vote: ${error.message}`);

  return { ok: true };
}

// Owner-only: hapus 1 pesan (moderasi). Kalau pesannya tipe 'poll', polling
// & votes yang nempel ke pesan itu ikut kehapus.
export async function deleteCommunityMessage(id: string) {
  const supabase = getSupabaseAdmin();

  const { data: msg } = await supabase
    .from(MSG_TABLE)
    .select("type, poll_id")
    .eq("id", id)
    .maybeSingle();

  if (msg?.type === "poll" && msg.poll_id) {
    await supabase.from(VOTE_TABLE).delete().eq("poll_id", msg.poll_id);
    await supabase.from(POLL_TABLE).delete().eq("id", msg.poll_id);
  }

  const { error } = await supabase.from(MSG_TABLE).delete().eq("id", id);
  if (error) throw new Error(`Gagal hapus pesan: ${error.message}`);
}
