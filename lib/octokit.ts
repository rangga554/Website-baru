import { Octokit } from "@octokit/rest";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getOctokitFromSession() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  if (!token) return null;
  return new Octokit({ auth: token });
}

// Versi buat fitur Collaboration: kalau yang akses BUKAN owner repo, tapi
// collaborator yang udah di-accept, pakai token OWNER (dari DB) — biar
// collaborator bisa edit repo yang bukan miliknya di GitHub.
//
// PENTING: ini KHUSUS buat operasi TULIS (edit file, hapus, commit, dll).
// Jangan dipakai buat GET/baca — kalau dipakai buat baca, orang yang cuma
// mau LIHAT repo publik orang lain (bukan owner, bukan collaborator) bakal
// selalu ke-block, padahal baca repo publik gak butuh izin khusus sama
// sekali di GitHub API. Buat baca, pakai getOctokitForRead() di bawah.
export async function getOctokitForRepo(targetOwner: string, targetRepo: string) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  const myToken = (session as any)?.accessToken as string | undefined;
  if (!myLogin || !myToken) return null;

  if (myLogin.toLowerCase() === targetOwner.toLowerCase()) {
    return new Octokit({ auth: myToken });
  }

  const { isAcceptedCollaborator, getGithubToken } = await import("./collaboration");
  const allowed = await isAcceptedCollaborator(myLogin, targetOwner, targetRepo);
  if (!allowed) return null;

  const ownerToken = await getGithubToken(targetOwner);
  if (!ownerToken) return null;
  return new Octokit({ auth: ownerToken });
}

// Versi buat operasi BACA (GET) — info repo, README, file tree, commits,
// branches, dll. Beda dari getOctokitForRepo: siapa aja yang udah login
// (bukan cuma owner/collaborator) tetep boleh baca, karena baca repo
// PUBLIK gak butuh delegated token apapun — token GitHub siapa aja bisa
// baca repo publik siapa aja. Kalau ternyata repo-nya PRIVATE dan user
// gak punya akses, GitHub API sendiri yang bakal nolak (404), jadi tetep
// aman buat repo private.
export async function getOctokitForRead(targetOwner: string, targetRepo: string) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  const myToken = (session as any)?.accessToken as string | undefined;
  if (!myLogin || !myToken) return null;

  // Owner & collaborator tetep lewat jalur yang sama kayak sebelumnya
  // (collaborator baca pakai token owner, biar konsisten buat repo yang
  // kebetulan private tapi collaborator-nya emang diundang).
  if (myLogin.toLowerCase() === targetOwner.toLowerCase()) {
    return new Octokit({ auth: myToken });
  }
  const { isAcceptedCollaborator, getGithubToken } = await import("./collaboration");
  const allowed = await isAcceptedCollaborator(myLogin, targetOwner, targetRepo);
  if (allowed) {
    const ownerToken = await getGithubToken(targetOwner);
    if (ownerToken) return new Octokit({ auth: ownerToken });
  }

  // Bukan owner & bukan collaborator -> tetep kasih token milik sendiri.
  // Cukup buat baca repo publik siapa aja; repo private bakal ke-reject
  // sendiri sama GitHub API.
  return new Octokit({ auth: myToken });
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

// Batasi jumlah request paralel ke GitHub API. Kalau semua item diproses
// sekaligus lewat Promise.all tanpa batas, repo yang isinya banyak file
// (ratusan/ribuan) bisa (a) buka koneksi HTTPS bersamaan sampai kelewat
// batas file descriptor server ("EMFILE: too many open files"), dan (b)
// gampang kena SECONDARY RATE LIMIT GitHub (403) — GitHub nge-block
// sementara kalau ngedetek terlalu banyak request nulis dalam waktu
// singkat, apapun jenis tokennya. Fungsi ini jalanin task per-batch
// (default beberapa sekaligus) biar jumlah request "serentak" tetap wajar.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// Wrapper createBlob dengan retry otomatis KHUSUS buat error yang sifatnya
// sementara (secondary rate limit GitHub/403, 429, atau 5xx) — BUKAN buat
// error asli (401/404/422/dll, itu percuma diulang). Dipakai bareng
// mapWithConcurrency di atas: concurrency yang dibatasi ngurangin PELUANG
// kena rate limit dari awal, retry ini jaring pengaman kalau tetap kena.
export async function createBlobWithRetry(
  octokit: Octokit,
  args: { owner: string; repo: string; content: string; encoding: "base64" | "utf-8" },
  maxAttempts = 6
) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await octokit.git.createBlob(args);
    } catch (e: any) {
      const status = e?.status;
      // GitHub balikin 403 buat DUA hal beda: beneran gak punya izin, ATAU
      // secondary rate limit. Bedainnya dari pesannya — beneran gak ada
      // header/status khusus buat mastiin, jadi kita cek kata kuncinya.
      const isRateLimited =
        status === 403 && /rate limit|abuse detection/i.test(String(e?.message || ""));
      const isTransient = isRateLimited || status === 429 || (status >= 500 && status < 600);

      if (!isTransient || attempt >= maxAttempts) throw e;

      // GitHub kadang ngasih tau persis berapa lama harus nunggu lewat
      // header ini — kalau ada, pakai itu (lebih akurat daripada nebak).
      const retryAfterHeader = e?.response?.headers?.["retry-after"];
      const waitMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : Math.min(30000, attempt * 2500);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}
