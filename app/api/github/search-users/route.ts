import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const page = Number(searchParams.get("page") || "1");

  if (!q.trim()) return Response.json([]);

  try {
    const { data } = await octokit.search.users({
      q,
      per_page: 24,
      page,
    });
    return Response.json(data.items);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
