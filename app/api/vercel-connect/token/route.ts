import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { saveConnection, validateVercelToken } from "@/lib/thirdPartyApps";

// POST { token, teamId? } — validasi Personal Access Token Vercel LANGSUNG
// ke API mereka (identitas + coba list project). Kalau gagal, DITOLAK di
// sini juga, token gak pernah disimpan ke database.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  const { token, teamId } = await req.json();
  if (!token || typeof token !== "string" || !token.trim()) {
    return Response.json({ error: "Token gak boleh kosong" }, { status: 400 });
  }

  const result = await validateVercelToken(token.trim(), teamId?.trim() || null);
  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  await saveConnection(identity.id, "vercel", {
    access_token: token.trim(),
    provider_account_id: result.user.id,
    provider_team_id: teamId?.trim() || null,
    account_email: result.user.email,
    account_name: result.user.name,
  });

  return Response.json({ ok: true });
}
