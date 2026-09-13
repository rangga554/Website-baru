import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.actions.listRepoWorkflows({
      owner: params.owner,
      repo: params.repo,
    });
    return Response.json(data.workflows);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
