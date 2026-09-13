import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.repos.getReadme({
      owner: params.owner,
      repo: params.repo,
    });
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return Response.json({ content, path: data.path });
  } catch (e: any) {
    if (e.status === 404) return Response.json({ content: null });
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
