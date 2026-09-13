import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findNetlifySite, getLatestDeployment, normalizeNetlifyState } from "@/lib/netlify";

// GET ?owner=&repo=&branch=
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

  if (!process.env.NETLIFY_TOKEN) {
    return Response.json({ notConfigured: true });
  }

  try {
    const site = await findNetlifySite(owner, repo);
    if (!site) {
      return Response.json({ connected: false });
    }

    const deployment = await getLatestDeployment(site.id, branch);
    if (!deployment) {
      return Response.json({ connected: true, deployment: null });
    }

    return Response.json({
      connected: true,
      deployment: {
        id: deployment.id,
        url: deployment.deploy_ssl_url || deployment.ssl_url,
        state: normalizeNetlifyState(deployment.state),
        createdAt: deployment.created_at,
        inspectorUrl: `https://app.netlify.com/sites/${site.name}/deploys/${deployment.id}`,
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
