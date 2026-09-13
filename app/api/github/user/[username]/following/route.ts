import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.users.listFollowingForUser({
      username: params.username,
      per_page: 50,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
