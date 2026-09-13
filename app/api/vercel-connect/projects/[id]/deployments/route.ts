import { NextRequest } from "next/server";
import { requireVercelConnection } from "../../../_shared";
import { listVercelDeployments } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await listVercelDeployments(conn.access_token, params.id, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ deployments: result.data.deployments || [] });
}
