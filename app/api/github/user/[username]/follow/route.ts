import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET -> { following: boolean }
export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.users.checkPersonIsFollowedByAuthenticated({ username: params.username });
    return Response.json({ following: true });
  } catch (e: any) {
    if (e.status === 404) return Response.json({ following: false });
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.users.follow({ username: params.username });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    await octokit.users.unfollow({ username: params.username });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
