import { Octokit } from "@octokit/rest";
import { mapWithConcurrency, createBlobWithRetry } from "./octokit";

// Ambil {owner, repo} dari link GitHub publik yang diinput owner di panel
// Template. Nerima format https://github.com/owner/repo atau
// https://github.com/owner/repo.git atau ada trailing slash.
export function parseGithubRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

// Star source repo atas nama user yang pencet "Get". SENGAJA gagal-diam --
// kalau source repo udah dihapus/private/apapun, itu gak boleh gagalin
// proses copy-nya. Star cuma bonus side-effect, bukan syarat.
export async function starRepoSilently(octokit: Octokit, owner: string, repo: string) {
  try {
    await octokit.activity.starRepoForAuthenticatedUser({ owner, repo });
  } catch {
    // diem-diem aja
  }
}

// Copy SELURUH isi source repo (default branch-nya) jadi repo baru punya
// user, TANPA pakai Fork API -- fork selalu ninggalin label "Forked from"
// permanen di GitHub yang gak bisa disembunyiin, jadi gak bisa dipakai di
// sini (requirement: user gak boleh tau link repo sumbernya). Caranya:
// baca tree+blob dari source, upload ulang jadi blob baru di repo tujuan,
// commit manual. Hasilnya repo baru 100% independen, gak ada jejak ke asal.
export async function copyRepoContents(
  octokit: Octokit,
  source: { owner: string; repo: string },
  dest: { owner: string; repo: string }
) {
  const { data: sourceRepoInfo } = await octokit.repos.get({
    owner: source.owner,
    repo: source.repo,
  });
  const defaultBranch = sourceRepoInfo.default_branch;

  const { data: sourceRef } = await octokit.git.getRef({
    owner: source.owner,
    repo: source.repo,
    ref: `heads/${defaultBranch}`,
  });

  const { data: sourceTree } = await octokit.git.getTree({
    owner: source.owner,
    repo: source.repo,
    tree_sha: sourceRef.object.sha,
    recursive: "true",
  });

  if (sourceTree.truncated) {
    throw new Error(
      "Repo template ini kegedean buat di-copy sekaligus (GitHub Tree API truncated)."
    );
  }

  const blobEntries = sourceTree.tree.filter((e) => e.type === "blob");

  // Bikin repo tujuan dulu (auto_init biar langsung ada default branch +
  // 1 commit awal, dibutuhin sebagai parent commit pas nge-push isi asli).
  await octokit.repos.createForAuthenticatedUser({
    name: dest.repo,
    private: false,
    auto_init: true,
  });

  const { data: destRepoInfo } = await octokit.repos.get({
    owner: dest.owner,
    repo: dest.repo,
  });
  const destBranch = destRepoInfo.default_branch;

  // Baca tiap blob dari source, upload ulang sebagai blob BARU di repo
  // tujuan (SHA blob itu scoped per-repo, jadi gak bisa dipakai ulang
  // langsung -- harus beneran create blob baru). Dibatasin concurrency +
  // retry biar gak kena secondary rate limit GitHub kalau file-nya banyak.
  const newTreeEntries = await mapWithConcurrency(blobEntries, 5, async (entry) => {
    const { data: blob } = await octokit.git.getBlob({
      owner: source.owner,
      repo: source.repo,
      file_sha: entry.sha!,
    });
    const created = await createBlobWithRetry(octokit, {
      owner: dest.owner,
      repo: dest.repo,
      content: blob.content,
      encoding: "base64",
    });
    return {
      path: entry.path!,
      mode: entry.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: "blob" as const,
      sha: created.data.sha,
    };
  });

  const { data: newTree } = await octokit.git.createTree({
    owner: dest.owner,
    repo: dest.repo,
    tree: newTreeEntries,
  });

  const { data: destRef } = await octokit.git.getRef({
    owner: dest.owner,
    repo: dest.repo,
    ref: `heads/${destBranch}`,
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner: dest.owner,
    repo: dest.repo,
    message: "Initial commit",
    tree: newTree.sha,
    parents: [destRef.object.sha],
  });

  await octokit.git.updateRef({
    owner: dest.owner,
    repo: dest.repo,
    ref: `heads/${destBranch}`,
    sha: newCommit.sha,
    force: true,
  });

  return destRepoInfo;
}
