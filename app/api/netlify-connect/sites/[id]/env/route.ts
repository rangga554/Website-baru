import { NextRequest } from "next/server";
import { requireNetlifyConnection } from "../../../_shared";
import { createNetlifyEnvVar, deleteNetlifyEnvVar, getNetlifyPrimaryAccountId, listNetlifyEnvVars, updateNetlifyEnvVar } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const accountId = await getNetlifyPrimaryAccountId(conn.access_token);
  if (!accountId) return Response.json({ error: "Gagal mengambil account Netlify" }, { status: 500 });

  const result = await listNetlifyEnvVars(conn.access_token, accountId, params.id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ envs: result.data || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return Response.json({ error: "key dan value wajib diisi" }, { status: 400 });
  }

  const accountId = await getNetlifyPrimaryAccountId(conn.access_token);
  if (!accountId) return Response.json({ error: "Gagal mengambil account Netlify" }, { status: 500 });

  const result = await createNetlifyEnvVar(conn.access_token, accountId, params.id, { key, value });
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return Response.json({ error: "key dan value wajib diisi" }, { status: 400 });
  }

  const accountId = await getNetlifyPrimaryAccountId(conn.access_token);
  if (!accountId) return Response.json({ error: "Gagal mengambil account Netlify" }, { status: 500 });

  const result = await updateNetlifyEnvVar(conn.access_token, accountId, params.id, key, value);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return Response.json({ error: "key wajib diisi" }, { status: 400 });

  const accountId = await getNetlifyPrimaryAccountId(conn.access_token);
  if (!accountId) return Response.json({ error: "Gagal mengambil account Netlify" }, { status: 500 });

  const result = await deleteNetlifyEnvVar(conn.access_token, accountId, params.id, key);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}
