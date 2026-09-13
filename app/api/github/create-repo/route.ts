import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const body = await req.json();
  const { name, description, isPrivate, autoInit, gitignoreTemplate, license } = body;

  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: !!isPrivate,
      auto_init: autoInit ?? true,
      gitignore_template: gitignoreTemplate || undefined,
      license_template: license || undefined,
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
