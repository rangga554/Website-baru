import { getSupabaseAdmin } from "./supabase";

const VERCEL_API = "https://api.vercel.com";

// ============================================================================
// Tabel Supabase yang dibutuhkan buat token bypass per-repository (jalankan
// sekali di SQL Editor Supabase):
//
// create table vercel_protection_tokens (
//   owner text not null,
//   repo text not null,
//   bypass_secret text not null,
//   updated_at timestamptz not null default now(),
//   primary key (owner, repo)
// );
// ============================================================================

const PROTECTION_TABLE = "vercel_protection_tokens";

function normalize(v: string) {
  return v.trim().toLowerCase();
}

// Ambil token "Protection Bypass for Automation" yang disimpan user KHUSUS
// buat repo ini. Kalau belum pernah diisi, return null (nanti caller fallback
// ke VERCEL_AUTOMATION_BYPASS_SECRET dari env, kalau ada).
export async function getProtectionBypassSecret(
  owner: string,
  repo: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(PROTECTION_TABLE)
    .select("bypass_secret")
    .eq("owner", normalize(owner))
    .eq("repo", normalize(repo))
    .maybeSingle();

  if (error || !data) return null;
  return data.bypass_secret as string;
}

// Simpan/hapus token buat repo ini. Kirim secret kosong ("") buat hapus
// (misal project Vercel-nya udah ga di-protect lagi).
export async function setProtectionBypassSecret(
  owner: string,
  repo: string,
  secret: string
) {
  const supabase = getSupabaseAdmin();
  const trimmed = secret.trim();

  if (!trimmed) {
    const { error } = await supabase
      .from(PROTECTION_TABLE)
      .delete()
      .eq("owner", normalize(owner))
      .eq("repo", normalize(repo));
    if (error) throw new Error(`Gagal menghapus token: ${error.message}`);
    return { saved: false };
  }

  const { error } = await supabase.from(PROTECTION_TABLE).upsert({
    owner: normalize(owner),
    repo: normalize(repo),
    bypass_secret: trimmed,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Gagal menyimpan token: ${error.message}`);
  return { saved: true };
}

function authHeader() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN belum di-set di environment variable");
  return { Authorization: `Bearer ${token}` };
}

function teamQuery() {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : "";
}

// Kalau project Vercel-nya pakai Deployment Protection (Vercel Authentication /
// password), visitor biasa bakal ketemu halaman "request access" dulu sebelum
// bisa lihat preview-nya. Vercel sendiri nyediain fitur resmi buat ini:
// "Protection Bypass for Automation" — secret yang di-generate dari
// Project Settings -> Deployment Protection -> Protection Bypass for Automation.
// Nempelin secret itu sebagai query param bikin request-nya lolos tanpa
// halaman consent, dan `x-vercel-set-bypass-cookie=true` bikin bypass-nya
// nempel di cookie browser (penting buat dipakai di <iframe>).
//
// `secret` di sini boleh diisi token yang disimpan KHUSUS buat repo tertentu
// (lihat getProtectionBypassSecret). Kalau kosong/null, fallback ke
// VERCEL_AUTOMATION_BYPASS_SECRET di environment variable (token global,
// lama) biar tetep kompatibel buat yang belum pindah ke token per-repo.
export function withProtectionBypass(url: string, secret?: string | null) {
  const s = secret || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!s) return url;
  const u = new URL(url);
  u.searchParams.set("x-vercel-protection-bypass", s);
  // "true" doang ga cukup kalau diakses lewat <iframe> (cross-site) — cookie-nya
  // bakal ke-block browser. Harus "samesitenone" biar cookie bypass ini nempel
  // walau requestnya cross-site (asset JS/CSS di dalam iframe misalnya).
  u.searchParams.set("x-vercel-set-bypass-cookie", "samesitenone");
  return u.toString();
}

// Cari project Vercel yang terhubung ke repo GitHub tertentu (owner/repo)
export async function findVercelProject(owner: string, repo: string) {
  const res = await fetch(`${VERCEL_API}/v9/projects${teamQuery()}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Gagal ambil daftar project Vercel: ${await res.text()}`);
  const data = await res.json();

  const fullName = `${owner}/${repo}`.toLowerCase();
  const project = (data.projects || []).find((p: any) => {
    const link = p.link;
    if (!link) return false;
    const linkedRepo = `${link.org || link.owner || ""}/${link.repo || ""}`.toLowerCase();
    return linkedRepo === fullName || p.name?.toLowerCase() === repo.toLowerCase();
  });

  return project || null;
}

// Ambil deployment paling baru untuk branch tertentu. Kalau project Vercel-nya
// ga di-link ke GitHub (jadi deployment-nya ga punya info branch buat difilter),
// fallback ke deployment paling baru apa aja di project itu — biar fitur Test
// tetep bisa jalan tanpa perlu project Vercel di-connect ke GitHub dulu.
export async function getLatestDeployment(projectId: string, branch: string) {
  const teamId = process.env.VERCEL_TEAM_ID;

  const branchParams = new URLSearchParams({ projectId, limit: "1", branch });
  if (teamId) branchParams.set("teamId", teamId);
  const branchRes = await fetch(`${VERCEL_API}/v6/deployments?${branchParams.toString()}`, {
    headers: authHeader(),
  });
  if (branchRes.ok) {
    const branchData = await branchRes.json();
    const found = branchData.deployments?.[0];
    if (found) return found;
  }

  const fallbackParams = new URLSearchParams({ projectId, limit: "1" });
  if (teamId) fallbackParams.set("teamId", teamId);
  const fallbackRes = await fetch(`${VERCEL_API}/v6/deployments?${fallbackParams.toString()}`, {
    headers: authHeader(),
  });
  if (!fallbackRes.ok) throw new Error(`Gagal ambil deployment: ${await fallbackRes.text()}`);
  const fallbackData = await fallbackRes.json();
  return fallbackData.deployments?.[0] || null;
}

// Ambil beberapa deployment terakhir sekaligus (bukan cuma yang paling baru)
// buat dicocokkan ke tiap commit di Logs Panel — biar user bisa lihat status
// deploy (berhasil/gagal/lagi build) per commit, bukan cuma commit terakhir.
export async function getRecentDeployments(projectId: string, branch: string, limit = 20) {
  const teamId = process.env.VERCEL_TEAM_ID;

  const params = new URLSearchParams({ projectId, limit: String(limit), branch });
  if (teamId) params.set("teamId", teamId);
  const res = await fetch(`${VERCEL_API}/v6/deployments?${params.toString()}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Gagal ambil deployment: ${await res.text()}`);
  const data = await res.json();
  return (data.deployments || []) as Array<{
    uid: string;
    url: string;
    state?: string;
    readyState?: string;
    createdAt?: number;
    created?: number;
    meta?: { githubCommitSha?: string };
  }>;
}

// Ambil log build 1 deployment Vercel (dipanggil pas user tekan badge
// "Gagal deploy" di Logs Panel, buat ditampilkan + dianalisis AI).
export async function getDeploymentLogs(deploymentId: string): Promise<string> {
  const teamId = process.env.VERCEL_TEAM_ID;
  const params = new URLSearchParams({ direction: "forward", limit: "1000" });
  if (teamId) params.set("teamId", teamId);

  const res = await fetch(
    `${VERCEL_API}/v2/deployments/${deploymentId}/events?${params.toString()}`,
    { headers: authHeader() }
  );
  if (!res.ok) throw new Error(`Gagal ambil log deployment: ${await res.text()}`);
  const events = await res.json();

  return (events as any[])
    .map((e) => e.payload?.text || e.text || "")
    .filter(Boolean)
    .join("\n");
}

// Batalkan deployment yang lagi building/queued
export async function cancelDeployment(deploymentId: string) {
  const params = new URLSearchParams();
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) params.set("teamId", teamId);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${VERCEL_API}/v12/deployments/${deploymentId}/cancel${qs}`, {
    method: "PATCH",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Gagal membatalkan deployment: ${await res.text()}`);
  return res.json();
}
