import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";
import JSZip from "jszip";

// GET ?branch=main
// Bikin ZIP dari SEMUA file di repo (branch tertentu) lalu langsung
// di-stream sebagai file download. Beda dari link archive langsung ke
// github.com (yang dipakai di tampilan read-only) — ini pakai token OAuth
// user sendiri lewat octokit, jadi TETAP JALAN buat repo PRIVATE juga,
// nggak bergantung ke sesi login browser ke github.com.
//
// Catatan: dibatasi 1500 file per extract, biar nggak timeout/kehabisan
// memori buat repo yang gede banget. Kalau kena limit ini, kasih tau user.
const MAX_FILES = 1500;

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  if (!branch) return Response.json({ error: "branch wajib diisi" }, { status: 400 });

  try {
    const { data: refData } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
    });

    const { data: fullTree } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: refData.object.sha,
      recursive: "true",
    });

    const blobs = (fullTree.tree || []).filter((i) => i.type === "blob" && i.sha);
    if (blobs.length === 0) {
      return Response.json({ error: "Repo/branch ini kosong" }, { status: 400 });
    }
    if (blobs.length > MAX_FILES) {
      return Response.json(
        {
          error: `Repo ini punya ${blobs.length} file, di atas batas ${MAX_FILES} file buat extract-to-zip langsung dari sini. Coba pakai "git clone" atau download per-folder.`,
        },
        { status: 413 }
      );
    }

    const zip = new JSZip();

    // Ambil isi tiap file secara paralel (dibatasi biar gak nge-hit rate
    // limit GitHub sekaligus).
    const CONCURRENCY = 8;
    let idx = 0;
    const worker = async () => {
      while (idx < blobs.length) {
        const item = blobs[idx++];
        const { data: blob } = await octokit.git.getBlob({
          owner: params.owner,
          repo: params.repo,
          file_sha: item.sha!,
        });
        const buffer = Buffer.from(blob.content, "base64");
        zip.file(item.path!, buffer);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const zipBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const body = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${params.repo}-${branch}.zip"`,
        "Content-Length": String(zipBuffer.byteLength),
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
