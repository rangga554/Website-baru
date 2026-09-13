import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET() {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  try {
    const { data } = await octokit.users.getAuthenticated();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { name?, bio?, company?, location?, blog?, twitter_username? }
export async function PATCH(req: NextRequest) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();
  const body = await req.json();
  try {
    const { data } = await octokit.users.updateAuthenticated({
      name: body.name,
      bio: body.bio,
      company: body.company,
      location: body.location,
      blog: body.blog,
      twitter_username: body.twitter_username,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
