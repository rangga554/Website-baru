import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection, listRobloxUniverses, parseRobloxSecret } from "@/lib/thirdPartyApps";

export async function GET() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  const conn = await getConnection(identity.id, "roblox");
  if (!conn) return Response.json({ connected: false });

  const secret = parseRobloxSecret(conn.access_token);
  const userId = Number(conn.provider_account_id);
  const result = await listRobloxUniverses(secret.cookie, userId);

  if (result.ok === false) {
    return Response.json({
      connected: true,
      account: { name: conn.account_name },
      hasApiKey: !!secret.apiKey,
      error: result.error,
    });
  }

  return Response.json({
    connected: true,
    account: { name: conn.account_name },
    hasApiKey: !!secret.apiKey,
    universes: result.universes,
  });
}
