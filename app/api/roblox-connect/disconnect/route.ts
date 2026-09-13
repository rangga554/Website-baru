import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { deleteConnection } from "@/lib/thirdPartyApps";

export async function POST() {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  await deleteConnection(identity.id, "roblox");
  return Response.json({ ok: true });
}
