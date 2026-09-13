const NETLIFY_API = "https://api.netlify.com/api/v1";

function authHeader() {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) throw new Error("NETLIFY_TOKEN belum di-set di environment variable");
  return { Authorization: `Bearer ${token}` };
}

// Status mentah Netlify ("ready", "error", "building", "new", "processing",
// "enqueued", "preparing", "uploading", "uploaded") disamain ke bentuk yang
// sama dipakai badge Vercel (READY / ERROR / building) biar UI-nya seragam.
export function normalizeNetlifyState(state: string): string {
  if (state === "ready") return "READY";
  if (state === "error") return "ERROR";
  return state.toUpperCase(); // BUILDING / NEW / PROCESSING / dst -> dianggap "lagi jalan"
}

// Cari site Netlify yang terhubung ke repo GitHub tertentu (owner/repo)
export async function findNetlifySite(owner: string, repo: string) {
  const res = await fetch(`${NETLIFY_API}/sites`, { headers: authHeader() });
  if (!res.ok) throw new Error(`Gagal ambil daftar site Netlify: ${await res.text()}`);
  const sites = await res.json();

  const fullName = `${owner}/${repo}`.toLowerCase();
  const site = (sites as any[]).find((s) => {
    const repoPath = (s.build_settings?.repo_path || "").toLowerCase();
    return repoPath === fullName || s.name?.toLowerCase() === repo.toLowerCase();
  });

  return site || null;
}

export async function getLatestDeployment(siteId: string, branch: string) {
  const branchRes = await fetch(
    `${NETLIFY_API}/sites/${siteId}/deploys?branch=${encodeURIComponent(branch)}&per_page=1`,
    { headers: authHeader() }
  );
  if (branchRes.ok) {
    const found = (await branchRes.json())?.[0];
    if (found) return found;
  }

  // Fallback: site-nya mungkin ga di-link ke branch tertentu, ambil
  // deployment paling baru apa aja.
  const fallbackRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys?per_page=1`, {
    headers: authHeader(),
  });
  if (!fallbackRes.ok) throw new Error(`Gagal ambil deployment: ${await fallbackRes.text()}`);
  const data = await fallbackRes.json();
  return data?.[0] || null;
}

// Beberapa deployment terakhir sekaligus — buat dicocokkan ke tiap commit
// di Logs Panel (sama kayak getRecentDeployments di lib/vercel.ts).
export async function getRecentDeployments(siteId: string, branch: string, limit = 20) {
  const res = await fetch(
    `${NETLIFY_API}/sites/${siteId}/deploys?branch=${encodeURIComponent(branch)}&per_page=${limit}`,
    { headers: authHeader() }
  );
  if (!res.ok) throw new Error(`Gagal ambil deployment: ${await res.text()}`);
  const data = await res.json();
  return data as Array<{
    id: string;
    state: string;
    commit_ref?: string | null;
    ssl_url?: string;
    deploy_ssl_url?: string;
    created_at?: string;
  }>;
}

// Netlify ga punya endpoint "raw build log" resmi kayak Vercel — yang
// tersedia lewat API publik cuma error_message singkat + ringkasan step
// build (summary.messages). Buat kebutuhan AI Debugger ini udah cukup,
// karena bagian paling penting (pesan error-nya) ada di situ.
export async function getDeploymentLogs(deployId: string): Promise<string> {
  const res = await fetch(`${NETLIFY_API}/deploys/${deployId}`, { headers: authHeader() });
  if (!res.ok) throw new Error(`Gagal ambil log deployment: ${await res.text()}`);
  const d = await res.json();

  const lines: string[] = [];
  if (d.error_message) lines.push(`ERROR: ${d.error_message}`);
  for (const m of d.summary?.messages || []) {
    lines.push(`[${m.type || "info"}] ${m.title || ""}${m.description ? " — " + m.description : ""}`);
  }
  return lines.join("\n");
}

export async function cancelDeployment(deployId: string) {
  const res = await fetch(`${NETLIFY_API}/deploys/${deployId}/cancel`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`Gagal membatalkan deployment: ${await res.text()}`);
  return res.json();
}
