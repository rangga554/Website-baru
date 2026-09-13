import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection, listNetlifySites } from "@/lib/thirdPartyApps";

export async function GET() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  const conn = await getConnection(identity.id, "netlify");
  if (!conn) return Response.json({ connected: false });

  const result = await listNetlifySites(conn.access_token);

  if (result.ok === false) {
    return Response.json({
      connected: true,
      account: { email: conn.account_email, name: conn.account_name },
      error: result.error,
      errorStatus: result.status,
    });
  }

  return Response.json({
    connected: true,
    account: { email: conn.account_email, name: conn.account_name },
    sites: result.sites,
  });
}
