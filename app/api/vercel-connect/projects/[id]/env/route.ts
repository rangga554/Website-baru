import { NextRequest } from "next/server";
import { requireVercelConnection } from "../../../_shared";
import { createVercelEnvVar, deleteVercelEnvVar, listVercelEnvVars } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await listVercelEnvVars(conn.access_token, params.id, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ envs: result.data.envs || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const { key, value, target } = await req.json();
  if (!key || value === undefined || !Array.isArray(target) || target.length === 0) {
    return Response.json({ error: "key, value, dan target (production/preview/development) wajib diisi" }, { status: 400 });
  }

  const result = await createVercelEnvVar(conn.access_token, params.id, { key, value, target }, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const envId = req.nextUrl.searchParams.get("envId");
  if (!envId) return Response.json({ error: "envId wajib diisi" }, { status: 400 });

  const result = await deleteVercelEnvVar(conn.access_token, params.id, envId, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}
