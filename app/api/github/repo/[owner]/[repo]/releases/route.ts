import { getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.repos.listReleases({
      owner: params.owner,
      repo: params.repo,
      per_page: 30,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { tag_name, name, body, target_commitish, prerelease, draft }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();
  const b = await req.json();
  try {
    const { data } = await octokit.repos.createRelease({
      owner: params.owner,
      repo: params.repo,
      tag_name: b.tag_name,
      name: b.name || b.tag_name,
      body: b.body || "",
      target_commitish: b.target_commitish || undefined,
      prerelease: !!b.prerelease,
      draft: !!b.draft,
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
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();
  const { release_id } = await req.json();
  try {
    await octokit.repos.deleteRelease({
      owner: params.owner,
      repo: params.repo,
      release_id,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
