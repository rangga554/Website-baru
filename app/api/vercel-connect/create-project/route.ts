import { NextRequest } from "next/server";
import { requireVercelConnection } from "../_shared";
import { createVercelProject } from "@/lib/thirdPartyApps";

export async function POST(req: NextRequest) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Nama project wajib diisi" }, { status: 400 });
  }

  const result = await createVercelProject(conn.access_token, name.trim(), conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true, project: result.data });
}
