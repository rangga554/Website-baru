import { getOctokitForRepo, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// Hapus 1 file ATAU 1 folder beserta semua isinya (rekursif), jadi 1 commit
// aja — beda dari DELETE di /contents yang cuma bisa 1 file per commit.
// Caranya: ambil tree lengkap (recursive), cari semua entry yang path-nya
// persis sama ATAU diawali "path/", lalu di git tree baru kasih sha: null
// buat masing-masing entry itu (itu cara resmi Git Trees API buat "hapus
// path ini dari tree").
//
// Body: { path, branch, message?, deleteAll?, keepPaths? }
//   deleteAll -> true buat hapus SEMUA file di root repo (dipakai fitur
//                "Delete & Extract Zip" pas currentFolder = root, karena
//                folder root gak punya "path" buat difilter kayak folder
//                biasa). Kalau deleteAll true, `path` boleh dikosongin.
//   keepPaths -> daftar path yang JANGAN ikut dihapus walau ada di dalam
//                scope (path/deleteAll). Dipakai buat "sync" ala Delete &
//                Extract Zip: yang beneran dihapus cuma file yang gak ada
//                di ZIP tujuan (misal README.md lama yang gak ke-include
//                di ZIP baru) — file yang bakal ditulis ulang toh gak
//                perlu dihapus dulu (skip-nya konten sama sudah dihandle
//                otomatis sama endpoint /tree pas upload).
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { path, branch, message, deleteAll, keepPaths } = await req.json();
  if (!branch || (!deleteAll && !path)) {
    return Response.json({ error: "path dan branch wajib diisi" }, { status: 400 });
  }

  try {
    const { data: refData } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
    });
    const latestCommitSha = refData.object.sha;

    const { data: commitData } = await octokit.git.getCommit({
      owner: params.owner,
      repo: params.repo,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    const { data: fullTree } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: baseTreeSha,
      recursive: "true",
    });

    let toDelete = deleteAll
      ? fullTree.tree || []
      : (fullTree.tree || []).filter(
          (item) => item.path === path || item.path?.startsWith(`${path}/`)
        );

    if (Array.isArray(keepPaths) && keepPaths.length > 0) {
      const keepSet = new Set<string>(keepPaths);
      // PENTING: di mode ini cuma boleh hapus di level "blob" (file).
      // Entry tipe "tree" (folder) SENGAJA dibuang total dari daftar hapus
      // — itu cuma penanda struktur yang GitHub hitung ULANG SENDIRI dari
      // sisa path file yang ada, bukan sesuatu yang perlu/boleh dihapus
      // manual. Kalau entry folder ikut di-null-in padahal masih ada
      // file di dalemnya yang di-keep, resikonya file itu ikut ke-"tarik"
      // hilang juga — makanya di sini scope-nya diperketat ke blob doang.
      toDelete = toDelete.filter((item) => item.type === "blob" && !keepSet.has(item.path!));
    }

    if (toDelete.length === 0) {
      // Repo/folder-nya emang udah kosong, atau semua yang ada di scope
      // udah ke-cover keepPaths (gak ada yang perlu dihapus) -> bukan error.
      if (deleteAll || (Array.isArray(keepPaths) && keepPaths.length > 0)) {
        return Response.json({ ok: true, deletedCount: 0 });
      }
      return Response.json({ error: "File/folder tidak ditemukan" }, { status: 404 });
    }

    const deletionEntries = toDelete.map((item) => ({
      path: item.path!,
      mode: item.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: item.type as "blob" | "tree" | "commit",
      sha: null,
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      // @ts-ignore -- sha: null valid di Git Trees API buat hapus entry, tipe octokit belum akomodasi ini
      tree: deletionEntries,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message: message || (deleteAll ? "Delete all files" : `Delete ${path}`),
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return Response.json({ ok: true, deletedCount: toDelete.length, commit: newCommit });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
