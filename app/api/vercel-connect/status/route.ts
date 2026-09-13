import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { getConnection, listVercelProjects } from "@/lib/thirdPartyApps";

export async function GET() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  const conn = await getConnection(identity.id, "vercel");
  if (!conn) return Response.json({ connected: false });

  const result = await listVercelProjects(conn.access_token, conn.provider_team_id);

  if (result.ok === false) {
    // Token kadaluarsa/dicabut/akun bermasalah -> tampilin APA ADANYA,
    // jangan disamarin. Kalau 401/403, kemungkinan besar user mencabut
    // akses dari sisi Vercel (bukan dari KRYNOS).
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
    projects: result.projects,
  });
}
