import { requireVercelConnection } from "../../../../_shared";
import { removeVercelDomain } from "@/lib/thirdPartyApps";

export async function DELETE(_req: Request, { params }: { params: { id: string; domain: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await removeVercelDomain(conn.access_token, params.id, decodeURIComponent(params.domain), conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true });
}
