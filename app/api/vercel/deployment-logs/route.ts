import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeploymentLogs } from "@/lib/vercel";

// GET ?deploymentId=xxx -> { logs }
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deploymentId = searchParams.get("deploymentId");
  if (!deploymentId) {
    return Response.json({ error: "deploymentId wajib diisi" }, { status: 400 });
  }

  try {
    const logs = await getDeploymentLogs(deploymentId);
    return Response.json({ logs: logs || "(log kosong)" });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
