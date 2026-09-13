import { getOctokitForRepo, getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  const { searchParams } = new URL(req.url);
  const state = (searchParams.get("state") as "open" | "closed" | "all") || "open";

  try {
    const { data } = await octokit.issues.listForRepo({
      owner: params.owner,
      repo: params.repo,
      state,
      per_page: 50,
    });
    return Response.json(data.filter((i) => !i.pull_request));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { title, body, labels? }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();
  const { title, body, labels } = await req.json();

  try {
    const { data } = await octokit.issues.create({
      owner: params.owner,
      repo: params.repo,
      title,
      body,
      labels,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
