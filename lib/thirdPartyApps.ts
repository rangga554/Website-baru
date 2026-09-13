import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

// ============================================================================
// APLIKASI PIHAK KETIGA — Vercel & Netlify, per-user (akun MASING-MASING
// user KRYNOS, BUKAN VERCEL_TOKEN/NETLIFY_TOKEN global punya owner yang
// dipakai fitur Deployment lama di lib/vercel.ts / lib/netlify.ts).
//
// Vercel: pakai Personal Access Token (user tempel sendiri, TIDAK BUTUH
//         env var apapun) — lihat validateVercelToken() di bawah.
// Netlify: pakai OAuth App. Env var yang WAJIB di-set (lihat .env.example):
//   NETLIFY_OAUTH_CLIENT_ID, NETLIFY_OAUTH_CLIENT_SECRET
// Redirect URI yang didaftarin di dashboard Netlify HARUS persis:
//   {NEXTAUTH_URL}/api/netlify-connect/callback
// ============================================================================

export type Provider = "vercel" | "netlify" | "roblox";

export type ThirdPartyConnection = {
  identity_key: string;
  provider: Provider;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  provider_account_id: string | null;
  provider_team_id: string | null;
  account_email: string | null;
  account_name: string | null;
  connected_at: string;
  updated_at: string;
};

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export function redirectUriFor(provider: Provider): string {
  return `${baseUrl()}/api/${provider}-connect/callback`;
}

// ----------------------------------------------------------------------------
// State CSRF (dipakai di /authorize dan dicocokin lagi di /callback)
// ----------------------------------------------------------------------------
export async function createOAuthState(identityKey: string, provider: Provider): Promise<string> {
  const state = randomBytes(24).toString("hex");
  const supabase = getSupabaseAdmin();
  await supabase.from("third_party_oauth_states").insert({
    state,
    identity_key: identityKey,
    provider,
  });
  return state;
}

// Return identity_key kalau state VALID & belum kadaluarsa (10 menit), null
// kalau enggak (invalid, udah kepake, atau expired). State langsung dibuang
// di sini (one-time use), gak peduli valid atau enggak.
export async function consumeOAuthState(state: string, provider: Provider): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("third_party_oauth_states")
    .select("*")
    .eq("state", state)
    .eq("provider", provider)
    .maybeSingle();

  await supabase.from("third_party_oauth_states").delete().eq("state", state);

  if (!data) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return null; // expired

  return data.identity_key as string;
}

// ----------------------------------------------------------------------------
// Simpan / ambil / hapus koneksi
// ----------------------------------------------------------------------------
export async function getConnection(identityKey: string, provider: Provider): Promise<ThirdPartyConnection | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("third_party_connections")
    .select("*")
    .eq("identity_key", identityKey)
    .eq("provider", provider)
    .maybeSingle();
  return (data as ThirdPartyConnection) || null;
}

export async function saveConnection(
  identityKey: string,
  provider: Provider,
  fields: {
    access_token: string;
    refresh_token?: string | null;
    token_type?: string | null;
    scope?: string | null;
    provider_account_id?: string | null;
    provider_team_id?: string | null;
    account_email?: string | null;
    account_name?: string | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("third_party_connections").upsert(
    {
      identity_key: identityKey,
      provider,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "identity_key,provider" }
  );
}

export async function deleteConnection(identityKey: string, provider: Provider): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("third_party_connections").delete().eq("identity_key", identityKey).eq("provider", provider);
}

// ============================================================================
// VERCEL — pakai Personal Access Token (BUKAN OAuth Integration).
//
// KENAPA GANTI DARI OAUTH: buat dapetin token yang beneran bisa akses API
// project/deployment, Vercel ngeharusin daftar "Integration" lewat
// Integrations Console (proses submission yang lumayan ribet, banyak field
// wajib kayak yang buat integrasi publik beneran). Personal Access Token
// JAUH lebih simpel — user tinggal generate sendiri dari akun Vercel
// mereka (vercel.com/account/tokens), tempel ke KRYNOS, kelar. Prinsip
// sama persis kayak Personal Access Token GitHub.
//
// "Otomatis cek izin, kalau kurang ditolak": Vercel PAT gak punya sistem
// scope granular kayak OAuth (bukan checkbox pilih "read-only"/"write" per
// fitur) — token itu otomatis punya akses sesuai SCOPE yang dipilih user
// pas bikin (Personal Account, atau salah satu Team tertentu). Jadi "cek
// izin" di sini artinya: begitu token ditempel, KRYNOS langsung TES
// token itu ke API Vercel beneran (ambil identitas + coba list project).
// Kalau gagal (401/403/dll), koneksi DITOLAK saat itu juga dengan alasan
// ASLI dari Vercel — token gak disimpan sama sekali kalau gagal.
// ============================================================================
export async function getVercelUser(accessToken: string): Promise<{
  id: string;
  email: string | null;
  name: string | null;
} | null> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok === false) return null;
  const data = await res.json();
  return { id: data.user?.uid, email: data.user?.email || null, name: data.user?.name || data.user?.username || null };
}

// Dipakai halaman status — kembaliin APA ADANYA respons Vercel kalau gagal
// (jangan disamarin jadi "terjadi kesalahan" generik), biar user bisa liat
// pesan asli dari Vercel kalau akunnya emang kenapa-napa (token dicabut,
// dll). Ini yang dimaksud "jujur soal status akun" dari awal diskusi fitur
// ini.
export async function listVercelProjects(accessToken: string, teamId?: string | null) {
  const qs = teamId ? `?teamId=${teamId}` : "";
  const res = await fetch(`https://api.vercel.com/v9/projects${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) {
    return { ok: false as const, status: res.status, error: data?.error?.message || "Gagal mengambil daftar project Vercel" };
  }
  return { ok: true as const, projects: data.projects || [] };
}

// Validasi token + cek izin sekaligus — dipanggil sekali pas user pertama
// kali nempel token-nya di halaman "Aplikasi Pihak Ketiga". Kalau lolos,
// baru token-nya disimpan; kalau enggak, ditolak dengan alasan yang jelas.
export async function validateVercelToken(
  accessToken: string,
  teamId?: string | null
): Promise<
  | { ok: true; user: { id: string; email: string | null; name: string | null } }
  | { ok: false; error: string }
> {
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (userRes.ok === false) {
    if (userRes.status === 401 || userRes.status === 403) {
      return { ok: false, error: "Token tidak valid atau sudah dicabut. Cek lagi token-nya, atau generate token baru." };
    }
    return { ok: false, error: `Vercel menolak token ini: ${await userRes.text()}` };
  }
  const userData = await userRes.json();

  // Cek izin BENERAN bisa dipake (bukan cuma valid identitasnya) — coba
  // list project pake scope yang sama (personal atau team, sesuai teamId).
  const projCheck = await listVercelProjects(accessToken, teamId || null);
  if (projCheck.ok === false) {
    return {
      ok: false,
      error: `Token ini valid, tapi izinnya gak cukup buat akses project (${projCheck.error}). Pastikan token dibuat dengan scope "Full Account" (atau Team yang benar kalau kolom Team ID diisi).`,
    };
  }

  return {
    ok: true,
    user: {
      id: userData.user?.uid,
      email: userData.user?.email || null,
      name: userData.user?.name || userData.user?.username || null,
    },
  };
}

// ----------------------------------------------------------------------------
// FASE 2 — Env var, deployments, redeploy (test), create project
// ----------------------------------------------------------------------------
function vercelQs(teamId?: string | null) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelJson(accessToken: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) {
    return { ok: false as const, status: res.status, error: data?.error?.message || `Vercel API error (${res.status})` };
  }
  return { ok: true as const, data };
}

export async function getVercelProject(accessToken: string, projectId: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}${vercelQs(teamId)}`);
}

export async function listVercelEnvVars(accessToken: string, projectId: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/env${vercelQs(teamId)}`);
}

export async function createVercelEnvVar(
  accessToken: string,
  projectId: string,
  fields: { key: string; value: string; target: string[]; type?: "plain" | "encrypted" },
  teamId?: string | null
) {
  return vercelJson(accessToken, `https://api.vercel.com/v10/projects/${projectId}/env${vercelQs(teamId)}`, {
    method: "POST",
    body: JSON.stringify({ type: fields.type || "encrypted", key: fields.key, value: fields.value, target: fields.target }),
  });
}

export async function deleteVercelEnvVar(accessToken: string, projectId: string, envId: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/env/${envId}${vercelQs(teamId)}`, {
    method: "DELETE",
  });
}

// List env var (v9) SENGAJA gak nyertain value asli (Vercel nyembunyiin
// demi keamanan) — buat ngeliat isinya, mesti minta 1-per-1 pake
// ?decrypt=true. Baru dipanggil pas user KLIK tombol "lihat", bukan pas
// list-nya di-load, biar gak nembak API sia-sia buat env var yang gak
// dicek satupun.
export async function getVercelEnvVarValue(accessToken: string, projectId: string, envId: string, teamId?: string | null) {
  const qs = teamId ? `?decrypt=true&teamId=${encodeURIComponent(teamId)}` : `?decrypt=true`;
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/env/${envId}${qs}`);
}

export async function updateVercelEnvVar(
  accessToken: string,
  projectId: string,
  envId: string,
  fields: { value: string; target: string[] },
  teamId?: string | null
) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/env/${envId}${vercelQs(teamId)}`, {
    method: "PATCH",
    body: JSON.stringify({ value: fields.value, target: fields.target }),
  });
}

export async function listVercelDeployments(accessToken: string, projectId: string, teamId?: string | null) {
  const qs = new URLSearchParams({ projectId, limit: "15" });
  if (teamId) qs.set("teamId", teamId);
  return vercelJson(accessToken, `https://api.vercel.com/v6/deployments?${qs.toString()}`);
}

// "Logs" = event/build log dari 1 deployment. Vercel gak nyediain 1 blob log
// simpel — ini stream event (step demi step build). Kita ambil apa adanya,
// gak diringkas/diubah supaya user bisa liat pesan error ASLI kalau build
// gagal.
export async function getVercelDeploymentLogs(accessToken: string, deploymentId: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v3/deployments/${deploymentId}/events${vercelQs(teamId)}`);
}

// "Test" / redeploy — Vercel gak punya tombol "redeploy" API terpisah;
// caranya bikin deployment BARU yang nunjuk ke deployment lama sebagai
// sumber file (persis kayak tombol "Redeploy" di dashboard Vercel).
export async function redeployVercel(
  accessToken: string,
  projectName: string,
  sourceDeploymentId: string,
  teamId?: string | null
) {
  return vercelJson(accessToken, `https://api.vercel.com/v13/deployments${vercelQs(teamId)}`, {
    method: "POST",
    body: JSON.stringify({ name: projectName, deploymentId: sourceDeploymentId, target: "production" }),
  });
}

export async function createVercelProject(accessToken: string, name: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v11/projects${vercelQs(teamId)}`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ----------------------------------------------------------------------------
// Manage Domain — Vercel
// ----------------------------------------------------------------------------
export async function listVercelDomains(accessToken: string, projectId: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/domains${vercelQs(teamId)}`);
}

export async function addVercelDomain(accessToken: string, projectId: string, domain: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v10/projects/${projectId}/domains${vercelQs(teamId)}`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

export async function removeVercelDomain(accessToken: string, projectId: string, domain: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}${vercelQs(teamId)}`, {
    method: "DELETE",
  });
}

// Vercel misahin "config" (DNS udah bener/belum) dari data domain itu
// sendiri — dipanggil terpisah biar bisa nunjukin status VERIFIKASI yang
// akurat (jujur), bukan cuma "domain ke-daftar" doang.
export async function getVercelDomainConfig(accessToken: string, domain: string, teamId?: string | null) {
  return vercelJson(accessToken, `https://api.vercel.com/v6/domains/${domain}/config${vercelQs(teamId)}`);
}

// ----------------------------------------------------------------------------
// Bantuin nentuin "apex domain" (root, butuh A record, host = @) vs
// "subdomain" (butuh CNAME, host = bagian sebelum apex-nya) — DIPAKE BUAT
// NETLIFY doang, soalnya Vercel udah ngasih tau apex-nya langsung lewat
// field `apexName` di response API (lihat pemakaiannya di route domains).
//
// PENTING: sebelumnya ini cuma ngitung jumlah titik (length === 2), yang
// SALAH buat domain dengan TLD 2-level kayak punya Indonesia (.co.id,
// .go.id, dst) — "toko.co.id" ke-anggep subdomain (disaranin CNAME host
// "toko"), padahal itu domain root yang butuh A record host "@". Ini bukan
// daftar public-suffix-list lengkap, tapi nyakup yang paling umum dipake.
const KNOWN_TWO_PART_SUFFIXES = new Set([
  "co.id", "go.id", "ac.id", "sch.id", "web.id", "or.id", "net.id", "biz.id", "my.id", "desa.id", "mil.id",
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk", "ltd.uk", "net.uk",
  "com.au", "net.au", "org.au", "gov.au", "edu.au",
  "co.jp", "co.kr", "co.nz", "co.in", "co.za",
  "com.br", "com.sg", "com.my", "com.mx", "com.ar", "com.tr", "com.tw", "com.hk", "com.ph", "com.vn",
]);

export function splitDomainHost(domain: string): { isApex: boolean; host: string; apex: string } {
  const parts = domain.split(".");
  if (parts.length <= 2) return { isApex: true, host: "@", apex: domain };

  const lastTwo = parts.slice(-2).join(".");
  const apexLabelCount = KNOWN_TWO_PART_SUFFIXES.has(lastTwo) ? 3 : 2;

  if (parts.length <= apexLabelCount) return { isApex: true, host: "@", apex: domain };

  return {
    isApex: false,
    host: parts.slice(0, parts.length - apexLabelCount).join("."),
    apex: parts.slice(-apexLabelCount).join("."),
  };
}

// ============================================================================
// NETLIFY
// ============================================================================
export function buildNetlifyAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NETLIFY_OAUTH_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUriFor("netlify"),
    state,
  });
  return `https://app.netlify.com/authorize?${params.toString()}`;
}

export async function exchangeNetlifyCode(code: string): Promise<{
  access_token: string;
  token_type: string;
  refresh_token?: string;
}> {
  const res = await fetch("https://api.netlify.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.NETLIFY_OAUTH_CLIENT_ID || "",
      client_secret: process.env.NETLIFY_OAUTH_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUriFor("netlify"),
      grant_type: "authorization_code",
    }),
  });
  if (res.ok === false) {
    throw new Error(`Gagal tukar kode OAuth Netlify: ${await res.text()}`);
  }
  return res.json();
}

export async function getNetlifyUser(accessToken: string): Promise<{
  id: string;
  email: string | null;
  name: string | null;
} | null> {
  const res = await fetch("https://api.netlify.com/api/v1/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok === false) return null;
  const data = await res.json();
  return { id: data.id, email: data.email || null, name: data.full_name || null };
}

export async function listNetlifySites(accessToken: string) {
  const res = await fetch("https://api.netlify.com/api/v1/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) {
    return { ok: false as const, status: res.status, error: (data as any)?.message || "Gagal mengambil daftar site Netlify" };
  }
  return { ok: true as const, sites: data || [] };
}

// ----------------------------------------------------------------------------
// FASE 2 — Env var, deploys, trigger build (test), create site
// ----------------------------------------------------------------------------
async function netlifyJson(accessToken: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) {
    return { ok: false as const, status: res.status, error: (data as any)?.message || `Netlify API error (${res.status})` };
  }
  return { ok: true as const, data };
}

// Env var Netlify itu ke-attach ke ACCOUNT (bukan langsung ke site), terus
// discope ke site tertentu lewat query "site_id". Jadi butuh account_id
// dulu — kita ambil account PERTAMA (personal account) punya user.
export async function getNetlifyPrimaryAccountId(accessToken: string): Promise<string | null> {
  const result = await netlifyJson(accessToken, "https://api.netlify.com/api/v1/accounts");
  if (result.ok === false || !Array.isArray(result.data) || result.data.length === 0) return null;
  return result.data[0].id as string;
}

export async function listNetlifyEnvVars(accessToken: string, accountId: string, siteId: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/accounts/${accountId}/env?site_id=${siteId}`);
}

export async function createNetlifyEnvVar(
  accessToken: string,
  accountId: string,
  siteId: string,
  fields: { key: string; value: string; scopes?: string[] }
) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/accounts/${accountId}/env?site_id=${siteId}`, {
    method: "POST",
    body: JSON.stringify({
      key: fields.key,
      scopes: fields.scopes || ["builds", "functions", "runtime", "post-processing"],
      values: [{ value: fields.value, context: "all" }],
    }),
  });
}

export async function deleteNetlifyEnvVar(accessToken: string, accountId: string, siteId: string, key: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/accounts/${accountId}/env/${key}?site_id=${siteId}`, {
    method: "DELETE",
  });
}

// Netlify (beda dari Vercel) balikin value ASLI langsung di list env var,
// jadi gak perlu endpoint "reveal" terpisah — tinggal ditampilin, cuma di-
// mask di sisi tampilan (UI) doang.
export async function updateNetlifyEnvVar(accessToken: string, accountId: string, siteId: string, key: string, value: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/accounts/${accountId}/env/${key}?site_id=${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ key, values: [{ value, context: "all" }] }),
  });
}

export async function listNetlifyDeploys(accessToken: string, siteId: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=15`);
}

// Netlify gak punya endpoint "1 blob log" yang rapi kayak GitHub Actions —
// detail deploy ini yang paling deket (berisi error_message & summary kalau
// build gagal). Ditampilin apa adanya, gak diringkas.
export async function getNetlifyDeployDetail(accessToken: string, deployId: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/deploys/${deployId}`);
}

// "Test" — trigger build baru dari source yang udah ke-link ke site
// (repo/build hook). Kalau site-nya bukan hasil link repo (misal upload
// manual doang), Netlify bakal nolak ini — ditampilin apa adanya kalau gagal.
export async function triggerNetlifyBuild(accessToken: string, siteId: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}/builds`, { method: "POST" });
}

export async function createNetlifySite(accessToken: string, name: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ----------------------------------------------------------------------------
// Manage Domain — Netlify
//
// Beda dari Vercel: Netlify nempelin domain lewat 2 cara —
//   1) custom_domain (domain UTAMA site, cuma 1)
//   2) domain_aliases (daftar domain TAMBAHAN, boleh banyak, semuanya ikut
//      ngarah ke site yang sama)
// Kita gabungin dua-duanya jadi 1 tampilan "daftar domain" di UI, biar
// user gak perlu ngerti bedanya cara Netlify motong-motong ini.
// ----------------------------------------------------------------------------
export async function getNetlifySite(accessToken: string, siteId: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}`);
}

export async function addNetlifyDomainAlias(accessToken: string, siteId: string, domain: string) {
  const current = await getNetlifySite(accessToken, siteId);
  if (current.ok === false) return current;

  const aliases: string[] = current.data.domain_aliases || [];
  if (aliases.includes(domain)) {
    return { ok: false as const, status: 400, error: "Domain ini udah ditambahkan sebelumnya" };
  }

  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ domain_aliases: [...aliases, domain] }),
  });
}

export async function removeNetlifyDomain(accessToken: string, siteId: string, domain: string) {
  const current = await getNetlifySite(accessToken, siteId);
  if (current.ok === false) return current;

  // Domain utama (custom_domain) dikosongin; kalau bukan itu, berarti ada
  // di daftar alias, dibuang dari situ.
  if (current.data.custom_domain === domain) {
    return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: "PATCH",
      body: JSON.stringify({ custom_domain: null }),
    });
  }

  const aliases: string[] = (current.data.domain_aliases || []).filter((d: string) => d !== domain);
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ domain_aliases: aliases }),
  });
}

// Set/ganti domain UTAMA (custom_domain) — beda dari alias biasa, ini yang
// jadi URL "resmi" site-nya.
export async function setNetlifyPrimaryDomain(accessToken: string, siteId: string, domain: string) {
  return netlifyJson(accessToken, `https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ custom_domain: domain }),
  });
}

// Netlify gak punya endpoint "cek DNS domain X" langsung kayak Vercel — SSL
// state di object site (`ssl_url`, `ssl`) adalah indikator paling deket buat
// nunjukin domain-nya udah beneran ke-verifikasi & aktif HTTPS-nya atau
// belum. Ditampilin apa adanya (jujur), bukan ngasih status "Verified"
// palsu kalau sebenernya cuma domain-nya kesimpen tapi DNS belum bener.
export async function getNetlifyDomainVerification(accessToken: string, siteId: string) {
  const result = await getNetlifySite(accessToken, siteId);
  if (result.ok === false) return result;
  return {
    ok: true as const,
    data: {
      ssl: result.data.ssl,
      state: result.data.state,
      domainAliases: result.data.domain_aliases || [],
      customDomain: result.data.custom_domain || null,
      dnsZoneId: result.data.dns_zone_id || null,
      defaultSubdomain: result.data.default_domain || (result.data.name ? `${result.data.name}.netlify.app` : null),
    },
  };
}

// Kalau site-nya udah punya DNS Zone di Netlify (opsi "pindah nameserver
// sepenuhnya ke Netlify" — bukan external DNS), ini nameserver yang perlu
// di-setting di registrar domain-nya. Dipanggil cuma kalau dns_zone_id ada.
export async function getNetlifyDnsZoneNameservers(accessToken: string, dnsZoneId: string) {
  const result = await netlifyJson(accessToken, `https://api.netlify.com/api/v1/dns_zones/${dnsZoneId}`);
  if (result.ok === false) return result;
  return { ok: true as const, nameservers: result.data.dns_servers || [] };
}

// ============================================================================
// ROBLOX — pakai cookie .ROBLOSECURITY (sama prinsipnya kayak Personal
// Access Token Vercel: milik akun user SENDIRI, ditempel manual, TIDAK ADA
// OAuth resmi dari Roblox buat ini). Endpoint yang dipakai di bawah adalah
// endpoint INTERNAL Roblox (dipakai website Roblox sendiri, bukan Open
// Cloud publik) — bisa berubah sewaktu-waktu tanpa pemberitahuan.
//
// FILE PLACE (.rbxl): lihat lib/robloxPlaceFile.ts buat cara baca/tulisnya.
// ============================================================================

function robloxCookieHeader(cookie: string): string {
  const c = cookie.trim();
  return c.startsWith(".ROBLOSECURITY=") ? c : `.ROBLOSECURITY=${c}`;
}

// Kredensial Roblox yang disimpan sebenernya bisa berisi 2 hal: cookie
// .ROBLOSECURITY (wajib, buat SEMUA fitur) dan API Key Open Cloud (opsional,
// KHUSUS dibutuhin buat publish/save Place — endpoint itu satu-satunya yang
// Roblox wajibkan pakai x-api-key, gak bisa cookie). Disimpan sebagai JSON
// di kolom access_token yang sama, tapi tetep backward-compatible kalau
// isinya masih cookie polos (koneksi lama sebelum fitur ini ada).
export type RobloxSecret = { cookie: string; apiKey?: string };
export function parseRobloxSecret(raw: string): RobloxSecret {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cookie === "string") return parsed;
  } catch {}
  return { cookie: raw }; // koneksi lama: raw = cookie polos
}
export function encodeRobloxSecret(secret: RobloxSecret): string {
  return JSON.stringify(secret);
}

// Roblox butuh X-CSRF-TOKEN buat semua request POST/PATCH/DELETE — caranya:
// tembak endpoint apapun yang butuh CSRF tanpa header itu, Roblox balikin
// 403 + header x-csrf-token isinya token yang valid buat request berikutnya.
export async function getRobloxCsrfToken(cookie: string): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: robloxCookieHeader(cookie) },
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error("Gagal mendapatkan CSRF token dari Roblox (cookie mungkin sudah tidak valid).");
  return token;
}

async function robloxFetch(cookie: string, url: string, init?: RequestInit, withCsrf?: boolean) {
  const headers: Record<string, string> = {
    Cookie: robloxCookieHeader(cookie),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (withCsrf) headers["X-CSRF-TOKEN"] = await getRobloxCsrfToken(cookie);
  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function validateRobloxCookie(
  cookie: string
): Promise<{ ok: true; user: { id: number; name: string; displayName: string } } | { ok: false; error: string }> {
  const res = await robloxFetch(cookie, "https://users.roblox.com/v1/users/authenticated");
  if (res.ok === false) {
    if (res.status === 401) return { ok: false, error: "Cookie .ROBLOSECURITY tidak valid, sudah kadaluarsa, atau sudah di-logout dari akun Roblox-nya." };
    return { ok: false, error: `Roblox menolak cookie ini (${res.status}).` };
  }
  const data = await res.json();
  return { ok: true, user: { id: data.id, name: data.name, displayName: data.displayName || data.name } };
}

// ----------------------------------------------------------------------------
// Universe & Place
// ----------------------------------------------------------------------------
export async function listRobloxUniverses(cookie: string, userId: number) {
  const universes: any[] = [];
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ accessFilter: "2", limit: "50", sortOrder: "Asc" });
    if (cursor) qs.set("cursor", cursor);
    const res = await robloxFetch(cookie, `https://games.roblox.com/v2/users/${userId}/games?${qs.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok === false) return { ok: false as const, error: data?.errors?.[0]?.message || `Gagal mengambil daftar Universe (${res.status})` };
    universes.push(...(data.data || []));
    cursor = data.nextPageCursor || "";
    if (!cursor) break;
  }
  return { ok: true as const, universes };
}

export async function listRobloxPlaces(cookie: string, universeId: number) {
  const res = await robloxFetch(cookie, `https://develop.roblox.com/v1/universes/${universeId}/places?SortOrder=Asc&Limit=100`);
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) return { ok: false as const, error: data?.errors?.[0]?.message || `Gagal mengambil daftar Place (${res.status})` };
  return { ok: true as const, places: data.data || [] };
}

// Ambil daftar template resmi Roblox yang VALID buat dipakai bikin
// Universe/Place baru — endpoint ini yang dipakai halaman "Create" Roblox
// sendiri buat nampilin pilihan "Baseplate", "Flat Terrain", dll. Kita
// gak boleh hardcode 1 placeId sembarangan sebagai template karena harus
// PUBLIK & valid saat ini (bisa berubah/di-nonpublic-kan sewaktu-waktu).
export async function listRobloxGameTemplates(cookie: string) {
  const res = await robloxFetch(cookie, "https://develop.roblox.com/v1/gametemplates");
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) return { ok: false as const, error: data?.errors?.[0]?.message || `Gagal mengambil daftar template (${res.status})` };
  return { ok: true as const, templates: (data.data || []) as { id: number; name: string; placeId?: number; assetId?: number }[] };
}

// Bikin Universe baru (otomatis punya 1 Place default / root place bawaan
// Roblox — sesuai yang diminta "buat place pakai default").
export async function createRobloxUniverse(cookie: string, name: string, templatePlaceId?: number) {
  // Default template: Baseplate publik (95206881) — dipastiin user sendiri
  // ID ini valid & bisa dipakai, jadi gak perlu manggil /v1/gametemplates lagi.
  const template = templatePlaceId || 95206881;
  const res = await robloxFetch(
    cookie,
    "https://apis.roblox.com/universes/v1/universes/create",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templatePlaceId: template }),
    },
    true
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) return { ok: false as const, error: data?.message || data?.errors?.[0]?.message || `Gagal membuat Universe (${res.status})` };
  return { ok: true as const, universeId: data.universeId as number, rootPlaceId: data.rootPlaceId as number };
}

// Roblox TIDAK punya endpoint "hapus Universe" permanen — yang ada cuma
// ARSIPKAN (isArchived: true), yang bikin experience-nya nonaktif/gak
// muncul lagi tapi datanya tetap ada di sisi Roblox. Ini batas dari Roblox
// sendiri, bukan batasan KRYNOS.
export async function archiveRobloxUniverse(cookie: string, universeId: number) {
  const res = await robloxFetch(
    cookie,
    `https://develop.roblox.com/v2/universes/${universeId}/configuration`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isArchived: true }) },
    true
  );
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) return { ok: false as const, error: data?.message || data?.errors?.[0]?.message || `Gagal mengarsipkan Universe (${res.status})` };
  return { ok: true as const };
}

// Bikin Place baru DI DALAM universe yang sudah ada. Roblox sempat
// menghapus endpoint langsung buat ini — workaround resmi dari komunitas:
// bikin universe sementara (otomatis dapat 1 root place baru), lepas root
// place-nya dari situ, lalu tempelkan ke universe tujuan, baru universe
// sementaranya diarsipkan.
export async function createRobloxPlace(cookie: string, targetUniverseId: number, name: string) {
  const temp = await createRobloxUniverse(cookie, `${name} (temp)`);
  if (temp.ok === false) return temp;

  const removeRes = await robloxFetch(
    cookie,
    "https://www.roblox.com/universes/removeplace",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ universeId: temp.universeId, placeId: temp.rootPlaceId }),
    },
    true
  );
  if (removeRes.ok === false) {
    await archiveRobloxUniverse(cookie, temp.universeId);
    return { ok: false as const, error: `Gagal melepas Place dari Universe sementara (${removeRes.status})` };
  }

  const addRes = await robloxFetch(
    cookie,
    `https://apis.roblox.com/universes/v1/universes/${targetUniverseId}/places/${temp.rootPlaceId}/add-place`,
    { method: "POST" },
    true
  );
  await archiveRobloxUniverse(cookie, temp.universeId); // universe sementara udah gak dibutuhin, apapun hasil add-place di atas
  if (addRes.ok === false) {
    return { ok: false as const, error: `Place berhasil dibuat tapi gagal ditempel ke Universe tujuan (${addRes.status}). Place-id: ${temp.rootPlaceId}` };
  }

  // Rename place sesuai nama yang diminta user
  await robloxFetch(
    cookie,
    `https://develop.roblox.com/v1/places/${temp.rootPlaceId}`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) },
    true
  );

  return { ok: true as const, placeId: temp.rootPlaceId };
}

// Hapus Place — Roblox CUMA mengizinkan "lepas dari Universe" (removeplace)
// untuk Place yang BUKAN root/starting place. Root place gak bisa dihapus
// (kalau mau, ya hapus/arsipkan Universe-nya sekalian).
export async function removeRobloxPlace(cookie: string, universeId: number, placeId: number, isRootPlace: boolean) {
  if (isRootPlace) {
    return { ok: false as const, error: "Ini root/starting Place dari Universe-nya — Roblox tidak mengizinkan root Place dihapus sendiri. Arsipkan Universe-nya kalau memang mau menghapus semuanya." };
  }
  const res = await robloxFetch(
    cookie,
    "https://www.roblox.com/universes/removeplace",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ universeId, placeId }) },
    true
  );
  if (res.ok === false) return { ok: false as const, error: `Gagal menghapus Place (${res.status})` };
  return { ok: true as const };
}

// Edit nama/deskripsi Place — Roblox nyimpen ini di "place configuration",
// bukan di universe. Buat rename Universe (nama experience yang keliatan
// di halaman game-nya), yang perlu di-update sebenernya nama ROOT PLACE-nya
// (Universe sendiri gak punya field "name" terpisah).
export async function updateRobloxPlace(cookie: string, placeId: number, updates: { name?: string; description?: string }) {
  const body: Record<string, string> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.description !== undefined) body.description = updates.description;
  const res = await robloxFetch(
    cookie,
    `https://develop.roblox.com/v2/places/${placeId}`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    true
  );
  if (res.ok === false) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, error: data?.message || data?.errors?.[0]?.message || `Gagal mengedit Place (${res.status})` };
  }
  return { ok: true as const };
}

// ----------------------------------------------------------------------------
// Download & Upload file .rbxl (buat script explorer)
// ----------------------------------------------------------------------------
export async function downloadRobloxPlaceFile(cookie: string, placeId: number): Promise<Buffer> {
  const res = await robloxFetch(cookie, `https://assetdelivery.roblox.com/v1/asset/?id=${placeId}`, { redirect: "follow" as RequestRedirect });
  if (res.ok === false) throw new Error(`Gagal download file Place (${res.status}) — pastikan kamu owner Place ini.`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

// PENTING: endpoint publish/save Place ini KHUSUS wajib pakai x-api-key
// (Open Cloud API Key) — Roblox gak nerima cookie sama sekali di sini
// (beda dari hampir semua endpoint lain yang dipakai fitur ini). Kalau
// apiKey gak diisi user, error ini dikasih balik dengan jelas daripada
// nembak API dan dapet "Missing API Key Header" yang membingungkan.
export async function uploadRobloxPlaceFile(
  apiKey: string | undefined,
  universeId: number,
  placeId: number,
  buffer: Buffer,
  versionType: "Saved" | "Published"
): Promise<{ ok: true; versionNumber: number } | { ok: false; error: string }> {
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Butuh API Key Roblox (Open Cloud) buat nyimpen — cookie doang gak cukup buat endpoint publish. Tambahin API Key di halaman connect Roblox (menu Universe), bikin dulu di create.roblox.com/dashboard/credentials dengan izin universe-places:write buat Universe ini.",
    };
  }
  const res = await fetch(`https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-api-key": apiKey },
    body: buffer as any,
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok === false) return { ok: false, error: data?.message || data?.errors?.[0]?.message || `Gagal upload Place (${res.status})` };
  return { ok: true, versionNumber: data.versionNumber };
}

// ----------------------------------------------------------------------------
// Open Cloud API Key — update HANYA bagian apiKey dari secret yang udah ada
// (cookie yang sudah tersimpan gak ikut kesentuh/ketimpa).
// ----------------------------------------------------------------------------
export async function updateRobloxApiKey(identityKey: string, currentCookie: string, apiKey: string): Promise<void> {
  await saveConnection(identityKey, "roblox", {
    access_token: encodeRobloxSecret({ cookie: currentCookie, apiKey: apiKey.trim() || undefined }),
  });
}

// PENTING: Open Cloud gak punya endpoint "list semua resource yang bisa
// diakses API Key ini" (dikonfirmasi gak ada endpoint kayak gitu per forum
// resmi Roblox). Makanya daftar Universe/Place TETAP dari cookie seperti
// biasa — API Key ini cuma dicek SATU-SATU per Universe buat kasih tau mana
// yang beneran diizinkan diakses key ini, bukan buat nge-generate daftarnya.
export async function checkRobloxApiKeyAccess(
  apiKey: string,
  universeId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://apis.roblox.com/cloud/v2/universes/${universeId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (res.ok) return { ok: true };
  if (res.status === 401) return { ok: false, error: "API Key tidak valid." };
  if (res.status === 403) return { ok: false, error: "API Key ini tidak diberi izin akses ke Universe ini." };
  if (res.status === 404) return { ok: false, error: "Universe tidak ditemukan lewat Open Cloud (kemungkinan API Key belum di-scope ke sini)." };
  return { ok: false, error: `Open Cloud menolak (${res.status})` };
}
