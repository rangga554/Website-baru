import { requireNetlifyConnection } from "../../../../_shared";
import { getNetlifyDeployDetail } from "@/lib/thirdPartyApps";

export async function GET(_req: Request, { params }: { params: { id: string; deployId: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await getNetlifyDeployDetail(conn.access_token, params.deployId);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ deploy: result.data });
}
