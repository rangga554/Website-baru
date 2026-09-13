import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection, parseRobloxSecret } from "@/lib/thirdPartyApps";

export async function requireRobloxConnection() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return { error: Response.json({ error: "Belum login" }, { status: 401 }) } as const;

  const conn = await getConnection(identity.id, "roblox");
  if (!conn) return { error: Response.json({ error: "Belum connect akun Roblox" }, { status: 400 }) } as const;

  const secret = parseRobloxSecret(conn.access_token);
  return { conn, identity, cookie: secret.cookie, apiKey: secret.apiKey } as const;
}
