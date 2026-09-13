import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listSecurityNotifications } from "@/lib/securityNotifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ notifications: [] });

  // Kunci yang sama kayak yang dipakai pas nyatet notifikasi (lihat
  // lib/knownDevices.ts & app/api/auth/change-password) — GitHub login
  // kalau ada, kalau nggak pakai "local:<username>".
  const login = (session as any).login as string | null;
  const localUsername = (session as any).localUsername as string | null;
  const identityKey = login || (localUsername ? `local:${localUsername}` : null);

  if (!identityKey) return Response.json({ notifications: [] });

  const notifications = await listSecurityNotifications(identityKey);
  return Response.json({ notifications });
}
