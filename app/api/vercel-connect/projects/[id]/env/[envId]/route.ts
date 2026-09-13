import { NextRequest } from "next/server";
import { requireVercelConnection } from "../../../../_shared";
import { getVercelEnvVarValue, updateVercelEnvVar } from "@/lib/thirdPartyApps";

// GET — "reveal" isi value asli 1 env var (dipanggil pas user klik ikon
// mata, BUKAN otomatis pas list di-load, biar gak nembak API sia-sia).
export async function GET(_req: NextRequest, { params }: { params: { id: string; envId: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await getVercelEnvVarValue(conn.access_token, params.id, params.envId, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ value: result.data.value ?? "" });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; envId: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const { value, target } = await req.json();
  if (value === undefined || !Array.isArray(target) || target.length === 0) {
    return Response.json({ error: "value dan target wajib diisi" }, { status: 400 });
  }

  const result = await updateVercelEnvVar(conn.access_token, params.id, params.envId, { value, target }, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });
  return Response.json({ ok: true });
}
