import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBanInfo } from "@/lib/userManagement";

// Dicek dari Dashboard tiap kali dibuka — biar user yang di-ban SAAT SEDANG
// login (session JWT-nya masih valid) tetap ke-tendang ke /banned, gak
// nunggu sampai session expired / login ulang.
export async function GET() {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login) return Response.json({ banned: false, reason: null, bannedAt: null });

  const info = await getBanInfo(login);
  return Response.json(info);
}
