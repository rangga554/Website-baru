import { NextRequest } from "next/server";
import { requireNetlifyConnection } from "../_shared";
import { createNetlifySite } from "@/lib/thirdPartyApps";

export async function POST(req: NextRequest) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Nama site wajib diisi" }, { status: 400 });
  }

  const result = await createNetlifySite(conn.access_token, name.trim());
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true, site: result.data });
}
