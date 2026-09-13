import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isEventActive } from "@/lib/event";

// Dipakai IndependenceDayBanner.tsx (semua user, bukan cuma owner) buat tau
// event lagi aktif apa enggak + HUT ke berapa. Sengaja cuma balikin 2 field
// ini (bukan seluruh EventSettings) biar gak bocorin detail jadwal ke user
// biasa.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await isEventActive();
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
