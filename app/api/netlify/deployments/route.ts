import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findNetlifySite, getRecentDeployments, normalizeNetlifyState } from "@/lib/netlify";

// GET ?owner=&repo=&branch= -> [{ sha, state, url, id }] — dipakai LogsPanel
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch");

  if (!owner || !repo || !branch) {
    return Response.json({ error: "owner, repo, branch wajib diisi" }, { status: 400 });
  }

  if (!process.env.NETLIFY_TOKEN) return Response.json([]);

  try {
    const site = await findNetlifySite(owner, repo);
    if (!site) return Response.json([]);

    const deployments = await getRecentDeployments(site.id, branch, 20);
    const mapped = deployments
      .filter((d) => d.commit_ref)
      .map((d) => ({
        sha: d.commit_ref,
        state: normalizeNetlifyState(d.state),
        url: d.deploy_ssl_url || d.ssl_url,
        id: d.id,
      }));

    return Response.json(mapped);
  } catch {
    return Response.json([]);
  }
}
