import { getOctokitForRepo, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// Duplikasi 1 file ATAU 1 folder beserta semua isinya (rekursif), jadi 1
// commit aja. Karena isi filenya SAMA PERSIS, gak perlu upload ulang
// konten (createBlob) — tinggal pakai lagi blob sha yang sudah ada, cuma
// path-nya aja yang beda di tree baru. Jauh lebih cepat & hemat API call
// dibanding baca-lalu-tulis ulang tiap file.
//
// Body: { path, newPath, branch, message? }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { path, newPath, branch, message } = await req.json();
  if (!path || !newPath || !branch) {
    return Response.json(
      { error: "path, newPath, dan branch wajib diisi" },
      { status: 400 }
    );
  }
  if (path === newPath) {
    return Response.json({ error: "Nama duplikat harus berbeda" }, { status: 400 });
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

    // Cuma perlu blob (file) — folder di Git bukan object tersendiri,
    // otomatis "kebentuk" begitu ada file dengan path di bawahnya.
    const toCopy = (fullTree.tree || []).filter(
      (item) =>
        item.type === "blob" &&
        (item.path === path || item.path?.startsWith(`${path}/`))
    );

    if (toCopy.length === 0) {
      return Response.json({ error: "File/folder tidak ditemukan" }, { status: 404 });
    }

    // Kalau path baru (atau isinya) udah dipakai, tolak — biar gak
    // ketiban timpa gak sengaja.
    const collision = (fullTree.tree || []).some(
      (item) => item.path === newPath || item.path?.startsWith(`${newPath}/`)
    );
    if (collision) {
      return Response.json(
        { error: "Nama/path tujuan duplikat sudah dipakai" },
        { status: 409 }
      );
    }

    const newEntries = toCopy.map((item) => ({
      path: item.path === path ? newPath : item.path!.replace(`${path}/`, `${newPath}/`),
      mode: item.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: "blob" as const,
      sha: item.sha!,
    }));

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      tree: newEntries,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message: message || `Duplicate ${path} to ${newPath}`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return Response.json({ ok: true, copiedCount: toCopy.length, commit: newCommit });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
