import { NextRequest } from "next/server";
import { requireNetlifyConnection } from "../../../_shared";
import { listNetlifyDeploys } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await listNetlifyDeploys(conn.access_token, params.id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ deploys: result.data || [] });
}
