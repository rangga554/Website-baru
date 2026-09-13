import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMyPlusSubmissions } from "@/lib/plus";

// Dipakai NotificationBell buat nunjukin notifikasi in-app "Plus aktif" /
// "Pengajuan ditolak" — BUKAN cuma andelin push notification (push bisa
// gagal kalau user belum kasih izin notifikasi browser / belum install
// PWA), jadi ini jalur yang PASTI kebaca tiap kali user buka dashboard.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  try {
    const submissions = await listMyPlusSubmissions(login, 20);
    return Response.json({ submissions });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
