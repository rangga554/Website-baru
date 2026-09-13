import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET ?ref=main -> daftar commit (log)
// GET ?sha=xxxx -> detail 1 commit termasuk file yang berubah (diff stat + patch)
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref") || undefined;
  const sha = searchParams.get("sha");
  const path = searchParams.get("path") || undefined;

  try {
    if (sha) {
      const { data } = await octokit.repos.getCommit({
        owner: params.owner,
        repo: params.repo,
        ref: sha,
      });
      return Response.json(data);
    }

    const { data } = await octokit.repos.listCommits({
      owner: params.owner,
      repo: params.repo,
      sha: ref,
      path,
      per_page: 40,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
