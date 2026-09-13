import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findVercelProject, getRecentDeployments } from "@/lib/vercel";

// GET ?owner=&repo=&branch= -> [{ sha, state, url }] — dipakai LogsPanel
// buat kasih badge status deploy (berhasil/gagal/building) di tiap commit.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch");

  if (!owner || !repo || !branch) {
    return Response.json({ error: "owner, repo, branch wajib diisi" }, { status: 400 });
  }

  // Diem-diem kirim array kosong kalau Vercel belum di-setup / project belum
  // ke-link — LogsPanel cuma nampilin badge kalau ada datanya, jadi ini gak
  // ganggu tampilan Logs biasa buat yang belum pakai Vercel.
  if (!process.env.VERCEL_TOKEN) return Response.json([]);

  try {
    const project = await findVercelProject(owner, repo);
    if (!project) return Response.json([]);

    const deployments = await getRecentDeployments(project.id, branch, 20);
    const mapped = deployments
      .filter((d) => d.meta?.githubCommitSha)
      .map((d) => ({
        sha: d.meta!.githubCommitSha,
        state: d.readyState || d.state,
        url: `https://${d.url}`,
        id: d.uid,
      }));

    return Response.json(mapped);
  } catch {
    // Sama seperti di atas — kalau gagal (misal token invalid), jangan
    // sampai bikin Logs Panel error, cukup gak ada badge aja.
    return Response.json([]);
  }
}
