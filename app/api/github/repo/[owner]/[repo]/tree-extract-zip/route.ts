import { getOctokitForRepo, unauthorized, mapWithConcurrency, createBlobWithRetry } from "@/lib/octokit";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import { createHash } from "crypto";

// Sama kayak di /tree/route.ts — git itu content-addressed (SHA-1 dari
// "blob <panjang>\0<isi>"), jadi kita bisa tau lokal isi file yang mau
// di-extract itu SAMA PERSIS apa enggak sama yang udah ada di path yang
// sama, tanpa perlu API call. Kalau sama, di-skip (gak createBlob, gak
// dihitung collision) — biar extract lebih ringan & gak ke-block gara-gara
// file yang isinya toh emang sama persis.
function gitBlobSha(bytes: Buffer): string {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf-8");
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

// Extract file .zip yang UDAH ADA di repo, jadi file/folder di lokasi yang
// sama (folder tempat .zip itu berada) — 1 commit aja, gak perlu
// download-lalu-upload manual.
//
// Body: { path, branch, deleteZipAfter?, message? }
//   path            -> path ke file .zip di repo, misal "assets/project.zip"
//   deleteZipAfter  -> kalau true, file .zip aslinya ikut dihapus dari
//                      commit yang sama setelah berhasil diekstrak
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { path, branch, deleteZipAfter, message } = await req.json();
  if (!path || !branch) {
    return Response.json({ error: "path dan branch wajib diisi" }, { status: 400 });
  }
  if (!path.toLowerCase().endsWith(".zip")) {
    return Response.json({ error: "File yang dipilih bukan .zip" }, { status: 400 });
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

    const zipEntry = (fullTree.tree || []).find((i) => i.type === "blob" && i.path === path);
    if (!zipEntry?.sha) {
      return Response.json({ error: "File .zip tidak ditemukan di repo" }, { status: 404 });
    }

    // Ambil isi .zip lewat Git Blob API (bukan Contents API) biar gak
    // kepotong 1MB kayak batasan Contents API.
    const { data: blob } = await octokit.git.getBlob({
      owner: params.owner,
      repo: params.repo,
      file_sha: zipEntry.sha,
    });
    if (blob.encoding !== "base64") {
      return Response.json({ error: "Format blob dari GitHub gak dikenal" }, { status: 500 });
    }
    const zipBuffer = Buffer.from(blob.content, "base64");

    const zip = await JSZip.loadAsync(zipBuffer);
    const fileEntries = Object.values(zip.files).filter((e) => !e.dir);
    if (fileEntries.length === 0) {
      return Response.json({ error: "ZIP kosong atau formatnya gak valid" }, { status: 400 });
    }

    // Sama kayak logic "Upload ZIP": kalau semua file ada di bawah 1 folder
    // pembungkus tunggal, folder itu di-skip.
    const topSegments = new Set(fileEntries.map((e) => e.name.split("/")[0]));
    let prefixToStrip = "";
    if (topSegments.size === 1) {
      const only = Array.from(topSegments)[0];
      if (fileEntries.every((e) => e.name.startsWith(only + "/"))) {
        prefixToStrip = only + "/";
      }
    }

    // Extract ke folder tempat .zip berada (bukan ke root repo).
    const lastSlash = path.lastIndexOf("/");
    const targetDir = lastSlash >= 0 ? path.slice(0, lastSlash) : "";

    const existingShaByPath = new Map<string, string>();
    for (const item of fullTree.tree || []) {
      if (item.type === "blob" && item.path && item.sha) {
        existingShaByPath.set(item.path, item.sha);
      }
    }

    // Tahap 1: hitung sha lokal & pilah mana yang beneran perlu di-upload —
    // ini MURNI kerjaan lokal (gak ada API call sama sekali), jadi aman
    // dikerjain sekaligus buat semua file tanpa resiko rate limit apapun.
    const toCreate: { finalPath: string; bytes: Buffer }[] = [];
    let skippedCount = 0;

    for (const entry of fileEntries) {
      const relPath = prefixToStrip ? entry.name.slice(prefixToStrip.length) : entry.name;
      if (!relPath) continue;
      const finalPath = targetDir ? `${targetDir}/${relPath}` : relPath;

      const bytes = Buffer.from(await entry.async("uint8array"));
      const computedSha = gitBlobSha(bytes);

      // Isinya sama persis kayak yang udah ada di path itu -> skip total,
      // gak createBlob, gak masuk tree baru, gak dianggap collision.
      if (existingShaByPath.get(finalPath) === computedSha) {
        skippedCount++;
        continue;
      }

      toCreate.push({ finalPath, bytes });
    }

    // Tahap 2: baru di sini ada API call ke GitHub (createBlob). SEBELUMNYA
    // ini jalan satu-satu berturutan tanpa jeda (for-loop + await) — kalau
    // filenya ratusan, itu ratusan request nulis beruntun dalam hitungan
    // detik, dan GitHub gampang nge-block sementara (secondary rate limit,
    // muncul sebagai HTTP 403 — BUKAN soal izin akses). Sekarang dibatasi
    // 5 request sekaligus (bukan tanpa batas) + retry otomatis kalau tetap
    // kena limit, biar extract file banyak tetap jalan sampai selesai.
    const created = await mapWithConcurrency(toCreate, 5, async ({ finalPath, bytes }) => {
      const { data: newBlob } = await createBlobWithRetry(octokit, {
        owner: params.owner,
        repo: params.repo,
        content: bytes.toString("base64"),
        encoding: "base64",
      });
      return { path: finalPath, mode: "100644" as const, type: "blob" as const, sha: newBlob.sha };
    });

    const extractedPaths = created.map((c) => c.path);
    const newEntries: {
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }[] = created;

    // Cek collision CUMA buat file yang isinya beneran BEDA dari yang udah
    // ada (yang isinya sama udah di-skip di atas, gak sampe sini).
    const collisions = extractedPaths.filter((p) => existingShaByPath.has(p));
    if (collisions.length > 0) {
      return Response.json(
        {
          error: `${collisions.length} file tujuan sudah ada dengan isi yang BEDA (misal "${collisions[0]}"). Pindahin/hapus dulu file yang bentrok sebelum extract.`,
        },
        { status: 409 }
      );
    }

    if (deleteZipAfter) {
      // Set sha: null pada path lama supaya createTree menghapus entry itu.
      newEntries.push({ path, mode: "100644", type: "blob", sha: null as any });
    }

    // Semua file di ZIP isinya udah sama persis kayak yang ada di repo, dan
    // .zip-nya juga gak diminta dihapus -> gak ada yang perlu di-commit.
    if (newEntries.length === 0) {
      return Response.json({ ok: true, extractedCount: 0, skippedCount, noChanges: true });
    }

    const { data: newTree } = await octokit.git.createTree({
      owner: params.owner,
      repo: params.repo,
      base_tree: baseTreeSha,
      tree: newEntries,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner: params.owner,
      repo: params.repo,
      message:
        message ||
        `Extract ${path}${skippedCount > 0 ? ` (${skippedCount} dilewati, isinya sama)` : ""}`,
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
      extractedCount: extractedPaths.length,
      skippedCount,
      commit: newCommit,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
