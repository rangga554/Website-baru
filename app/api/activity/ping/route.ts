import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordActivityPing } from "@/lib/ownerStats";

// Dipanggil berkala dari ActivityTracker (client) selama user login & tab
// lagi aktif — dasar hitung "Waktu Pakai", "User Aktif", dan "User Terdaftar"
// di Owner Panel. Kalau SUPABASE belum di-setup, diem-diem gagal aja (fitur
// ini opsional, gak boleh ganggu fitur lain kalau Supabase belum dikonfigurasi).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;
  if (!login) return Response.json({ error: "Login tidak ditemukan" }, { status: 400 });

  try {
    await recordActivityPing(login, avatar);
    return Response.json({ ok: true });
  } catch (e: any) {
    // Sengaja balikin 200 meski gagal (misal Supabase belum di-setup) —
    // ping ini gak kritis, jangan sampai bikin error kelihatan di console
    // user biasa tiap menit.
    return Response.json({ ok: false, error: e.message }, { status: 200 });
  }
}
