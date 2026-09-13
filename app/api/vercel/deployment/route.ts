import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  findVercelProject,
  getLatestDeployment,
  getProtectionBypassSecret,
  withProtectionBypass,
} from "@/lib/vercel";

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

  if (!process.env.VERCEL_TOKEN) {
    return Response.json({ notConfigured: true });
  }

  try {
    const project = await findVercelProject(owner, repo);
    if (!project) {
      return Response.json({ connected: false });
    }

    const deployment = await getLatestDeployment(project.id, branch);
    if (!deployment) {
      return Response.json({ connected: true, deployment: null });
    }

    // Token per-repo (diisi user di halaman Repo Settings) diprioritaskan;
    // kalau belum diisi, withProtectionBypass otomatis fallback ke
    // VERCEL_AUTOMATION_BYPASS_SECRET di env (kalau ada).
    const bypassSecret = await getProtectionBypassSecret(owner, repo);

    return Response.json({
      connected: true,
      deployment: {
        id: deployment.uid,
        url: withProtectionBypass(`https://${deployment.url}`, bypassSecret),
        state: deployment.readyState || deployment.state,
        createdAt: deployment.createdAt || deployment.created,
        inspectorUrl: `https://vercel.com/${project.accountId || ""}/${project.name}/${deployment.uid}`,
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
