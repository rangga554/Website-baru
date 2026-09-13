import { getSupabaseAdmin } from "./supabase";
import { isOwner, OWNER_LOGIN } from "./owner";
import { isAdmin, isOwnerOrAdmin, listAdmins } from "./admin";

// ============================================================================
// MESSAGE — chat 1-ke-1 antara user biasa dengan owner/admin.
//
// Aturan inti (ditegakkan di sini, bukan di level SQL):
// - Yang boleh MULAI obrolan baru CUMA user biasa (bukan owner/admin).
// - Owner/admin CUMA bisa BALAS obrolan yang udah ada, gak bisa mulai duluan.
// - Owner/admin (yang jadi tujuan obrolan itu) bisa "Akhiri Obrolan", yang
//   ngehapus PERMANEN baris conversation + semua pesannya dari Supabase
//   (bukan cuma ditandai selesai) — lihat endConversation().
//
// Tabel yang dibutuhkan ada di supabase_schema.txt (section 16).
// ============================================================================

const CONV_TABLE = "dm_conversations";
const MSG_TABLE = "dm_messages";

export type DmConversation = {
  id: string;
  user_login: string;
  admin_login: string;
  created_at: string;
  last_message_at: string;
};

export type DmMessage = {
  id: string;
  conversation_id: string;
  sender_login: string;
  content: string;
  created_at: string;
};

export type MessageTarget = {
  login: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
};

// Daftar tujuan yang bisa dipilih USER buat mulai chat: owner + semua admin.
// Avatar diambil best-effort dari user_activity (dipakai fitur lain juga
// buat nyimpen avatar_url tiap user yang pernah login) — kalau gak ketemu,
// biarin null aja (UI fallback ke avatar generik).
export async function listMessageTargets(): Promise<MessageTarget[]> {
  const admins = await listAdmins();
  const logins = [OWNER_LOGIN, ...admins.map((a) => a.login)];

  const supabase = getSupabaseAdmin();
  const { data: activity } = await supabase
    .from("user_activity")
    .select("login, avatar_url")
    .in(
      "login",
      logins.map((l) => l.toLowerCase())
    );

  const avatarByLogin = new Map(
    (activity || []).map((a) => [a.login.toLowerCase(), a.avatar_url as string | null])
  );

  return logins.map((login) => ({
    login,
    role: isOwner(login) ? "owner" : "admin",
    avatarUrl: avatarByLogin.get(login.toLowerCase()) || null,
  }));
}

// User bikin/buka obrolan ke 1 owner/admin. Idempotent — kalau obrolan
// antara pasangan (user, admin) ini udah ada, balikin yang lama aja
// (bukan bikin duplikat), berkat unique(user_login, admin_login).
export async function startOrGetConversation(
  userLogin: string,
  targetLogin: string
): Promise<DmConversation> {
  if ((await isOwnerOrAdmin(userLogin))) {
    throw new Error("NOT_INITIATOR"); // owner/admin gak boleh mulai obrolan
  }

  const targetIsOwner = isOwner(targetLogin);
  const targetIsAdmin = !targetIsOwner && (await isAdmin(targetLogin));
  if (!targetIsOwner && !targetIsAdmin) {
    throw new Error("INVALID_TARGET"); // cuma boleh chat ke owner/admin
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from(CONV_TABLE)
    .select("*")
    .eq("user_login", userLogin.toLowerCase())
    .eq("admin_login", targetLogin.toLowerCase())
    .maybeSingle();
  if (existing) return existing as DmConversation;

  const { data: created, error } = await supabase
    .from(CONV_TABLE)
    .insert({ user_login: userLogin.toLowerCase(), admin_login: targetLogin.toLowerCase() })
    .select()
    .single();
  if (error) throw new Error(`Gagal membuat obrolan: ${error.message}`);
  return created as DmConversation;
}

// Daftar obrolan MILIK seseorang — kalau dia user biasa, obrolan yang DIA
// mulai; kalau owner/admin, obrolan yang DITUJUKAN ke dia (inbox).
export async function listMyConversations(login: string): Promise<DmConversation[]> {
  const supabase = getSupabaseAdmin();
  const column = (await isOwnerOrAdmin(login)) ? "admin_login" : "user_login";
  const { data, error } = await supabase
    .from(CONV_TABLE)
    .select("*")
    .eq(column, login.toLowerCase())
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(`Gagal ambil daftar obrolan: ${error.message}`);
  return (data as DmConversation[]) || [];
}

export async function getConversationForParticipant(
  conversationId: string,
  login: string
): Promise<DmConversation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(CONV_TABLE)
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return null;

  const conv = data as DmConversation;
  const lower = login.toLowerCase();
  if (conv.user_login !== lower && conv.admin_login !== lower) return null; // bukan peserta
  return conv;
}

export async function listMessages(conversationId: string): Promise<DmMessage[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(MSG_TABLE)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal ambil pesan: ${error.message}`);
  return (data as DmMessage[]) || [];
}

// Kirim pesan — dipanggil abis getConversationForParticipant() konfirmasi
// pengirimnya beneran peserta obrolan ini (dicek di route handler).
export async function sendMessage(
  conversationId: string,
  senderLogin: string,
  content: string
): Promise<DmMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Pesan gak boleh kosong");
  if (trimmed.length > 2000) throw new Error("Pesan kepanjangan (maks 2000 karakter)");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(MSG_TABLE)
    .insert({ conversation_id: conversationId, sender_login: senderLogin.toLowerCase(), content: trimmed })
    .select()
    .single();
  if (error) throw new Error(`Gagal mengirim pesan: ${error.message}`);

  await supabase
    .from(CONV_TABLE)
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as DmMessage;
}

// Akhiri obrolan — CUMA boleh dipanggil owner ATAU admin yang jadi tujuan
// obrolan ini (dicek di route handler pakai getConversationForParticipant
// + isOwnerOrAdmin). Ini HAPUS PERMANEN baris conversation-nya, dan berkat
// "on delete cascade" di dm_messages, semua pesan di dalamnya ikut kehapus
// otomatis — persis kayak yang diminta: "reset obrolan" + "clearin di
// Supabase" jadi 1 aksi yang sama, bukan 2 langkah terpisah.
export async function endConversation(conversationId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(CONV_TABLE).delete().eq("id", conversationId);
  if (error) throw new Error(`Gagal mengakhiri obrolan: ${error.message}`);
}
