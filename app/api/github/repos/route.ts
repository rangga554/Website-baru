import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || "1");
  const q = searchParams.get("q") || "";

  try {
    if (q) {
      const { data } = await octokit.search.repos({
        q: `${q} user:@me`,
        per_page: 30,
        page,
      });
      return Response.json(data.items);
    }
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 30,
      page,
      sort: "updated",
    });
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
