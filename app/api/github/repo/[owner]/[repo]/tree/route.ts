import { getOctokitForRepo, getOctokitForRead, unauthorized, mapWithConcurrency, createBlobWithRetry } from "@/lib/octokit";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Git secara native udah content-addressed (SHA-1 dari "blob <panjang>\0<isi>"),
// jadi kita bisa tau persis file yang MAU di-upload isinya beda apa enggak
// dari yang UDAH ADA di path yang sama di repo — tanpa perlu nge-hit GitHub
// API sama sekali (murni hitung lokal). Kalau sama persis, file itu di-skip
// total (gak createBlob, gak masuk tree baru) biar upload lebih ringan &
// commit-nya bersih (cuma isi perubahan beneran).
function gitBlobSha(bytes: Buffer): string {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf-8");
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

function fileBytes(f: { content: string; isBase64?: boolean }): Buffer {
  return f.isBase64 ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf-8");
}

// GET ?ref=main -> seluruh struktur file & folder (recursive) buat file tree sidebar
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref") || undefined;

  try {
    const { data: refData } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${ref}`,
    });

    const { data } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: refData.object.sha,
      recursive: "true",
    });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Upload banyak file sekaligus (folder upload) jadi 1 commit
// Body: { branch, message, files: [{ path, content(base64), isBase64 }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { branch, message, files } = await req.json();

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

    // Ambil tree yang ada SEKARANG (recursive) buat tau sha blob tiap path
    // yang udah ada — dipakai buat bandingin, BUKAN buat nge-upload apa-apa.
    const { data: existingTree } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: baseTreeSha,
      recursive: "true",
    });
    const existingShaByPath = new Map<string, string>();
    for (const item of existingTree.tree || []) {
      if (item.type === "blob" && item.path && item.sha) {
        existingShaByPath.set(item.path, item.sha);
      }
    }

    // Pisahin file yang isinya SAMA PERSIS kayak yang udah ada di path itu
    // (skip total, hemat createBlob + hemat masuk commit) dari yang
    // beneran baru/berubah (baru di-createBlob).
    const toUpload: { path: string; content: string; isBase64?: boolean }[] = [];
    let skippedCount = 0;
    for (const f of files as { path: string; content: string; isBase64?: boolean }[]) {
      const computedSha = gitBlobSha(fileBytes(f));
      if (existingShaByPath.get(f.path) === computedSha) {
        skippedCount++;
      } else {
        toUpload.push(f);
      }
    }

    // Semua file yang dikirim isinya identik sama yang udah ada -> gak ada
    // yang perlu di-commit sama sekali, gak perlu bikin commit kosong.
    if (toUpload.length === 0) {
      return Response.json({ ok: true, skippedCount, uploadedCount: 0, noChanges: true });
    }

    // Buat blob CUMA buat file yang beneran baru/berubah. Dibatasi 6
    // request sekaligus (bukan Promise.all tanpa batas kayak sebelumnya) +
    // retry otomatis kalau kena secondary rate limit GitHub (403/429/5xx)
    // — batch besar (puluhan/ratusan file) gampang ke-block kalau semua
    // request ditembak bersamaan tanpa batas.
    const blobs = await mapWithConcurrency(toUpload, 6, async (f) => {
      const { data: blob } = await createBlobWithRetry(octokit, {
        owner: params.owner,
        repo: params.repo,
        content: f.content,
        encoding: f.isBase64 ? "base64" : "utf-8",
      });
      return {
        path: f.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    });

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      tree: blobs,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message:
        message ||
        `Upload ${toUpload.length} file${skippedCount > 0 ? ` (${skippedCount} dilewati, isinya sama)` : ""} via KRYNOS`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.git.updateRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return Response.json({
      ok: true,
      commit: newCommit,
      uploadedCount: toUpload.length,
      skippedCount,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
