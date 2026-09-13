import { getOctokitFromSession, unauthorized, mapWithConcurrency, createBlobWithRetry } from "@/lib/octokit";
import { NextRequest } from "next/server";

const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

// POST { mode: 'new'|'existing', repoName?, isPrivate?, targetOwner?, targetRepo? }
//
// SENGAJA tidak pakai octokit.repos.createFork (native GitHub fork), karena:
// - Fork GitHub tetap "terikat" ke repo asal (relasi fork), bukan repo mandiri
// - Fork dari repo PUBLIC tidak bisa langsung dibuat private lewat API
// Jadi di sini isi file disalin manual (blob per blob) jadi commit baru di
// repo tujuan — hasilnya repo yang BENERAN independen, milik akun sendiri,
// dan bebas mau public/private. Punya pemilik asli sama sekali tidak
// tersentuh/berubah, ini cuma proses BACA dari repo mereka.
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const mode: "new" | "existing" = body.mode === "existing" ? "existing" : "new";

  if (mode === "new" && !body.repoName) {
    return Response.json({ error: "repoName wajib diisi" }, { status: 400 });
  }
  if (mode === "new" && !REPO_NAME_RE.test(body.repoName)) {
    return Response.json(
      { error: "Nama repo cuma boleh huruf, angka, titik (.), garis bawah (_), dan strip (-)." },
      { status: 400 }
    );
  }
  if (mode === "existing" && (!body.targetOwner || !body.targetRepo)) {
    return Response.json(
      { error: "targetOwner dan targetRepo wajib diisi buat mode existing" },
      { status: 400 }
    );
  }

  try {
    // 1) Ambil seluruh struktur file repo sumber.
    const { data: source } = await octokit.repos.get({
      owner: params.owner,
      repo: params.repo,
    });
    const { data: ref } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${source.default_branch}`,
    });
    const { data: sourceTree } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: ref.object.sha,
      recursive: "true",
    });

    const blobEntries = (sourceTree.tree || []).filter(
      (e) => e.type === "blob" && e.sha && e.path
    );
    if (blobEntries.length === 0) {
      return Response.json({ error: "Repo sumber kosong, tidak ada yang bisa disalin." }, { status: 400 });
    }

    // 2) Baca isi tiap file dari repo sumber (dibatasi paralel biar ga EMFILE).
    const filesContent = await mapWithConcurrency(blobEntries, 8, async (entry) => {
      const { data: blob } = await octokit.git.getBlob({
        owner: params.owner,
        repo: params.repo,
        file_sha: entry.sha!,
      });
      return { path: entry.path!, mode: entry.mode, content: blob.content };
    });

    // 3) Tentukan repo tujuan: baru atau yang udah ada.
    let destOwner: string;
    let destRepo: string;
    let defaultBranch: string;

    if (mode === "new") {
      let created;
      try {
        const { data } = await octokit.repos.createForAuthenticatedUser({
          name: body.repoName,
          description: source.description || `Copy dari ${params.owner}/${params.repo}`,
          private: !!body.isPrivate,
          auto_init: true,
        });
        created = data;
      } catch (e: any) {
        if (e.status === 422) {
          return Response.json(
            { error: `Repo bernama "${body.repoName}" sudah ada di akun kamu. Pakai nama lain.` },
            { status: 400 }
          );
        }
        throw e;
      }
      destOwner = created.owner.login;
      destRepo = created.name;
      defaultBranch = created.default_branch || "main";
    } else {
      const { data: existing } = await octokit.repos.get({
        owner: body.targetOwner,
        repo: body.targetRepo,
      });
      if (!existing.permissions?.push) {
        return Response.json({ error: "Kamu tidak punya izin tulis ke repo ini." }, { status: 403 });
      }
      destOwner = existing.owner.login;
      destRepo = existing.name;
      defaultBranch = existing.default_branch || "main";
    }

    // 4) Titik awal commit di branch tujuan (auto_init utk repo baru, HEAD saat ini utk repo lama).
    const { data: destRef } = await octokit.git.getRef({
      owner: destOwner,
      repo: destRepo,
      ref: `heads/${defaultBranch}`,
    });
    const { data: destCommit } = await octokit.git.getCommit({
      owner: destOwner,
      repo: destRepo,
      commit_sha: destRef.object.sha,
    });

    // 5) Bikin blob baru di repo tujuan buat tiap file (isi dicopy langsung, dibatasi paralel).
    const newTreeEntries = await mapWithConcurrency(filesContent, 8, async (f) => {
      const { data: blob } = await createBlobWithRetry(octokit, {
        owner: destOwner,
        repo: destRepo,
        content: f.content,
        encoding: "base64",
      });
      return {
        path: f.path,
        mode: (f.mode || "100644") as "100644" | "100755" | "120000",
        type: "blob" as const,
        sha: blob.sha,
      };
    });

    // 6) Susun tree baru di atas base_tree tujuan (merge, path sama = ditimpa), commit, geser branch.
    const { data: newTree } = await octokit.git.createTree({
      owner: destOwner,
      repo: destRepo,
      base_tree: destCommit.tree.sha,
      tree: newTreeEntries,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: destOwner,
      repo: destRepo,
      message: `Copy dari ${params.owner}/${params.repo}`,
      tree: newTree.sha,
      parents: [destRef.object.sha],
    });

    await octokit.git.updateRef({
      owner: destOwner,
      repo: destRepo,
      ref: `heads/${defaultBranch}`,
      sha: newCommit.sha,
    });

    return Response.json({
      owner: destOwner,
      repo: destRepo,
      branch: defaultBranch,
      fileCount: blobEntries.length,
      mode,
    });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal menyalin repository" }, { status: e.status || 500 });
  }
}
