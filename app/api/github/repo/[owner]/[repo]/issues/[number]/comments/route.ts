import { getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string; number: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.issues.listComments({
      owner: params.owner,
      repo: params.repo,
      issue_number: Number(params.number),
      per_page: 100,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { body }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string; number: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();
  const { body } = await req.json();
  try {
    const { data } = await octokit.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: Number(params.number),
      body,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
