import { NextRequest } from "next/server";
import { requireVercelConnection } from "../../../../../_shared";
import { getVercelDeploymentLogs } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string; deploymentId: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await getVercelDeploymentLogs(conn.access_token, params.deploymentId, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  // Vercel balikin array event log mentah — dikirim apa adanya, biarin
  // frontend yang render (jangan diringkas di sini, biar pesan error asli
  // gak ilang detailnya).
  return Response.json({ events: Array.isArray(result.data) ? result.data : [] });
}
