import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  webm: "audio/webm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
};

// GET ?path=music/lagu.mp3&ref=main -> isi file BINARY ASLI (bukan JSON+base64).
//
// Kenapa perlu route terpisah dari /contents: endpoint /contents balikin isi
// file dibungkus base64 di dalam JSON. Base64 bikin ukuran data nambah ~33%,
// dan Vercel Functions punya batas ukuran response (~4.5MB per response).
// File musik/gambar yang aslinya di bawah limit bisa KETEMBUS limit itu
// begitu di-base64-in, bikin response kepotong/gagal → base64 rusak → gak
// bisa diputar/ditampilin browser. Route ini kirim byte asli file.
//
// CATATAN: sengaja PAKAI cara yang sama kayak fallback di /contents
// (getContent lalu, kalau kosong, git.getBlob) — bukan `mediaType: "raw"`
// lewat octokit.request langsung. Cara "raw" itu ternyata suka gagal/error
// di beberapa kondisi (media type request ke GitHub Contents API kadang
// direject atau balikin format yang gak konsisten). Cara getBlob ini yang
// sebelumnya SUDAH TERBUKTI jalan (dipakai buat baca isi file musik/gambar
// gede di /contents), jadi lebih aman dipakai lagi di sini.
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  const ref = searchParams.get("ref") || undefined;

  try {
    const { data } = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path,
      ref,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return Response.json({ error: "Bukan file" }, { status: 400 });
    }

    let base64: string;
    if ("content" in data && data.content && data.encoding === "base64") {
      base64 = data.content;
    } else {
      // File >1MB: Contents API gak nyertain isinya, ambil lewat Git Blob API
      const { data: blob } = await octokit.git.getBlob({
        owner: params.owner,
        repo: params.repo,
        file_sha: data.sha,
      });
      base64 = blob.content;
    }

    const buffer = Buffer.from(base64.replace(/\n/g, ""), "base64");

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mime = MIME_BY_EXT[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
