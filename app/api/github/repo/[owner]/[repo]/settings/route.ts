import { getOctokitFromSession, getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET dibuka buat SIAPA AJA yang login (baca info repo publik gak butuh
// izin khusus) — PATCH & DELETE di bawah TETAP owner-only (rename/hapus
// repo gak boleh didelegasikan).
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.repos.get({
      owner: params.owner,
      repo: params.repo,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Update pengaturan repository: nama, deskripsi, visibility, default branch, fitur (issues/wiki/projects)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  const body = await req.json();
  try {
    const { data } = await octokit.repos.update({
      owner: params.owner,
      repo: params.repo,
      name: body.name,
      description: body.description,
      private: body.private,
      default_branch: body.default_branch,
      has_issues: body.has_issues,
      has_wiki: body.has_wiki,
      has_projects: body.has_projects,
      archived: body.archived,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.repos.delete({ owner: params.owner, repo: params.repo });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
