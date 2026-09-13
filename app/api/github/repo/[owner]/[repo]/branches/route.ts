import { getOctokitFromSession, getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET dibuka buat siapa aja yang login — bikin/hapus branch (POST/DELETE
// di bawah) tetap pakai token sendiri (biar gak delegasi hal yang lebih
// beresiko ke token owner tanpa perlu).
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.repos.listBranches({
      owner: params.owner,
      repo: params.repo,
      per_page: 100,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { newBranch: string, fromBranch: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  const { newBranch, fromBranch } = await req.json();

  try {
    const { data: ref } = await octokit.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${fromBranch}`,
    });

    const { data } = await octokit.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${newBranch}`,
      sha: ref.object.sha,
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
  const { branch } = await req.json();
  try {
    await octokit.git.deleteRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${branch}`,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
