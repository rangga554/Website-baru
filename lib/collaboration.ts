import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan (SQL Editor Supabase):
//
// create table user_github_tokens (
//   login text primary key,
//   access_token text not null,
//   updated_at timestamptz not null default now()
// );
//
// create table collaboration_invites (
//   id uuid primary key default gen_random_uuid(),
//   owner_login text not null,
//   repo text not null,
//   invited_login text not null,
//   status text not null default 'pending', -- 'pending' | 'accepted' | 'declined'
//   created_at timestamptz not null default now(),
//   responded_at timestamptz
// );
// create index collab_invited_idx on collaboration_invites (invited_login, status);
// create index collab_owner_idx on collaboration_invites (owner_login, repo);
//
// ⚠️ CATATAN KEAMANAN PENTING: tabel user_github_tokens nyimpen access
// token GitHub asli di database (bukan cuma di cookie session kayak
// biasanya). Ini diperlukan supaya collaborator yang di-invite bisa
// "pinjam" akses lewat token si owner buat baca/tulis repo yang bukan
// milik mereka. Kalau database Supabase kamu bocor, token-token GitHub di
// tabel ini ikut bocor juga — pastikan Supabase project kamu aman
// (service role key jangan pernah bocor, RLS gak masalah karena API-nya
// selalu lewat server pakai service role).
// ============================================================================

const TOKEN_TABLE = "user_github_tokens";
const INVITE_TABLE = "collaboration_invites";

export async function saveGithubToken(login: string, accessToken: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(TOKEN_TABLE)
    .upsert({ login, access_token: accessToken, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function getGithubToken(login: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(TOKEN_TABLE)
    .select("access_token")
    .eq("login", login)
    .maybeSingle();
  return data?.access_token || null;
}

// Dipakai OWNER-ONLY buat fitur "auto-follow backfill" (lihat
// app/api/owner/auto-follow-backfill/route.ts) — biar user yang UDAH
// TERDAFTAR dari sebelum fitur auto-follow ada juga ke-follow-in owner
// tanpa perlu nunggu mereka login ulang.
export async function listAllGithubTokens(): Promise<{ login: string; access_token: string }[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(TOKEN_TABLE).select("login, access_token");
  if (error) throw new Error(`Gagal ambil daftar token: ${error.message}`);
  return data || [];
}

export async function inviteCollaborator(params: {
  ownerLogin: string;
  repo: string;
  invitedLogin: string;
}) {
  if (params.ownerLogin.toLowerCase() === params.invitedLogin.toLowerCase()) {
    throw new Error("Gak bisa invite diri sendiri");
  }
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from(INVITE_TABLE)
    .select("id, status")
    .eq("owner_login", params.ownerLogin)
    .eq("repo", params.repo)
    .eq("invited_login", params.invitedLogin)
    .maybeSingle();

  if (existing && existing.status === "pending") {
    throw new Error("Undangan buat user ini masih pending");
  }
  if (existing && existing.status === "accepted") {
    throw new Error("User ini udah jadi collaborator repo ini");
  }

  const { data, error } = await supabase
    .from(INVITE_TABLE)
    .upsert(
      {
        owner_login: params.ownerLogin,
        repo: params.repo,
        invited_login: params.invitedLogin,
        status: "pending",
        responded_at: null,
      },
      { onConflict: "owner_login,repo,invited_login" }
    )
    .select()
    .single();
  if (error) throw new Error(`Gagal mengirim undangan: ${error.message}`);
  return data;
}

export async function listPendingInvitesForUser(login: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(INVITE_TABLE)
    .select("*")
    .eq("invited_login", login)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Repo-repo yang BISA diakses user ini sebagai collaborator (udah accepted)
export async function listAcceptedCollaborations(login: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(INVITE_TABLE)
    .select("*")
    .eq("invited_login", login)
    .eq("status", "accepted")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Collaborator yang udah diterima buat 1 repo tertentu (dipakai owner buat
// lihat siapa aja yang punya akses)
export async function listCollaboratorsForRepo(ownerLogin: string, repo: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(INVITE_TABLE)
    .select("*")
    .eq("owner_login", ownerLogin)
    .eq("repo", repo)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function respondToInvite(params: {
  inviteId: string;
  login: string; // buat mastiin yang respond emang yang diundang
  accept: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const { data: invite } = await supabase
    .from(INVITE_TABLE)
    .select("*")
    .eq("id", params.inviteId)
    .maybeSingle();

  if (!invite) throw new Error("Undangan tidak ditemukan");
  if (invite.invited_login !== params.login) throw new Error("Ini bukan undangan buat kamu");
  if (invite.status !== "pending") throw new Error("Undangan ini udah pernah direspon");

  const { error } = await supabase
    .from(INVITE_TABLE)
    .update({ status: params.accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", params.inviteId);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function revokeCollaborator(params: { ownerLogin: string; repo: string; invitedLogin: string }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from(INVITE_TABLE)
    .delete()
    .eq("owner_login", params.ownerLogin)
    .eq("repo", params.repo)
    .eq("invited_login", params.invitedLogin);
  if (error) throw new Error(error.message);
}

export async function isAcceptedCollaborator(login: string, ownerLogin: string, repo: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(INVITE_TABLE)
    .select("id")
    .eq("owner_login", ownerLogin)
    .eq("repo", repo)
    .eq("invited_login", login)
    .eq("status", "accepted")
    .maybeSingle();
  return !!data;
}
