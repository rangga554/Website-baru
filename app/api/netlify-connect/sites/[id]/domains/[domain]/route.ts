import { NextRequest } from "next/server";
import { requireNetlifyConnection } from "../../../../_shared";
import { removeNetlifyDomain, setNetlifyPrimaryDomain } from "@/lib/thirdPartyApps";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; domain: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await removeNetlifyDomain(conn.access_token, params.id, decodeURIComponent(params.domain));
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true });
}

// Jadiin domain ini "primary" (custom_domain resmi site-nya)
export async function PATCH(_req: NextRequest, { params }: { params: { id: string; domain: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await setNetlifyPrimaryDomain(conn.access_token, params.id, decodeURIComponent(params.domain));
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true });
}
