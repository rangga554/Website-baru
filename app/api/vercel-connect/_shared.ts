import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection } from "@/lib/thirdPartyApps";

// Dipake bareng semua route /api/vercel-connect/projects/* — mastiin user
// login DAN udah connect Vercel sebelum ngizinin akses apapun ke project.
export async function requireVercelConnection() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return { error: Response.json({ error: "Belum login" }, { status: 401 }) } as const;

  const conn = await getConnection(identity.id, "vercel");
  if (!conn) return { error: Response.json({ error: "Belum connect akun Vercel" }, { status: 400 }) } as const;

  return { conn } as const;
}
