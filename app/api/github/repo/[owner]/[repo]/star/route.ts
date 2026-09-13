import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.activity.checkRepoIsStarredByAuthenticatedUser({
      owner: params.owner,
      repo: params.repo,
    });
    return Response.json({ starred: true });
  } catch (e: any) {
    if (e.status === 404) return Response.json({ starred: false });
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.activity.starRepoForAuthenticatedUser({
      owner: params.owner,
      repo: params.repo,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.activity.unstarRepoForAuthenticatedUser({
      owner: params.owner,
      repo: params.repo,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
