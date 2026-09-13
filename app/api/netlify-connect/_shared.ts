import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection } from "@/lib/thirdPartyApps";

export async function requireNetlifyConnection() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return { error: Response.json({ error: "Belum login" }, { status: 401 }) } as const;

  const conn = await getConnection(identity.id, "netlify");
  if (!conn) return { error: Response.json({ error: "Belum connect akun Netlify" }, { status: 400 }) } as const;

  return { conn } as const;
}
