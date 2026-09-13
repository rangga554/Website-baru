import { getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET ?path=src/index.js&ref=main  -> isi file atau listing folder
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  const ref = searchParams.get("ref") || undefined;
  // meta=1: dipakai buat file binary gede (musik/gambar) yang isinya diambil
  // lewat /raw (binary asli), jadi route ini cukup balikin metadata (sha,
  // size, dll) TANPA isi base64-nya sama sekali. Ini penting: kalau tetep
  // narik+balikin base64 di sini juga, responsenya bakal bengkak lagi
  // (base64 nambah ukuran ~33%) dan bisa ketembus limit ukuran response
  // Vercel Functions (~4.5MB) buat file yang cukup besar (musik, dll) —
  // itu penyebab file musik gagal diputar padahal filenya sendiri gak apa.
  const metaOnly = searchParams.get("meta") === "1";

  try {
    const { data } = await octokit.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path,
      ref,
    });

    if (!Array.isArray(data) && data.type === "file" && metaOnly) {
      const { content, encoding, ...meta } = data as any;
      return Response.json(meta);
    }

    // GitHub Contents API punya batasan: buat file BINARY/GEDE (>1MB, kayak
    // musik/mp3, video, gambar resolusi tinggi, dll), endpoint ini BALIKIN
    // content = "" (kosong) & encoding = "none" — metadata lain (sha, size)
    // tetep ada, tapi isinya beneran gak dikirim. Kalau kejadian gini, ambil
    // isinya lewat Git Blob API (dukung sampe 100MB, SELALU base64) pakai
    // sha yang sama. Tanpa ini, file kayak musik keliatan "kosong" padahal
    // isinya ada, dan gak bisa diputar/ditampilin sama sekali.
    if (
      !Array.isArray(data) &&
      data.type === "file" &&
      (!("content" in data) || !data.content || data.encoding !== "base64")
    ) {
      const { data: blob } = await octokit.git.getBlob({
        owner: params.owner,
        repo: params.repo,
        file_sha: data.sha,
      });
      return Response.json({ ...data, content: blob.content, encoding: blob.encoding });
    }

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

// Body: { path, content (base64 atau plain text), message, branch, sha? (kalau update file lama), isBase64? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { path, content, message, branch, sha, isBase64 } = await req.json();

  try {
    const encoded = isBase64
      ? content
      : Buffer.from(content, "utf-8").toString("base64");

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: params.owner,
      repo: params.repo,
      path,
      message: message || `Update ${path}`,
      content: encoded,
      branch,
      sha: sha || undefined,
    });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { path, message, branch, sha }
export async function DELETE(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { path, message, branch, sha } = await req.json();

  try {
    const { data } = await octokit.repos.deleteFile({
      owner: params.owner,
      repo: params.repo,
      path,
      message: message || `Delete ${path}`,
      branch,
      sha,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
