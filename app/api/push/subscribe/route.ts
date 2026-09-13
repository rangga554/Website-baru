import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { getIdentity } from "@/lib/identity";
import { saveSubscription } from "@/lib/push";

// Body: { subscription } — hasil dari pushManager.subscribe() di client
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
      return Response.json({ error: "subscription gak valid" }, { status: 400 });
    }

    // Owner & admin dapat SEMUA notifikasi (pengajuan Plus baru, dll), user
    // biasa cuma dapat notifikasi announcement baru.
    await saveSubscription({
      login: identity.id,
      scope: (await isOwnerOrAdmin(identity.id)) ? "all" : "announcement",
      subscription,
    });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
