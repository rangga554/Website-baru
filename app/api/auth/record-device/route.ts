import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkAndRecordDevice } from "@/lib/knownDevices";

// PENTING: deteksi device SENGAJA dipisah ke endpoint biasa kayak gini
// (bukan ditaruh di dalam callback NextAuth/lib/auth.ts). Sempat dicoba
// pakai headers() dari next/headers LANGSUNG di dalam callback jwt() —
// ternyata itu bikin proses login GAGAL TOTAL (kepental balik ke halaman
// login), soalnya headers() App Router gak selalu bisa diakses dengan
// aman dari dalam konteks callback NextAuth v4. Endpoint terpisah ini
// jalan sebagai request HTTP normal, jadi req.headers selalu aman diakses,
// dan dipanggil dari CLIENT SETELAH login-nya sendiri udah beres sukses —
// jadi kalaupun fitur ini gagal/error, login user gak bakal ke-ganggu
// sama sekali.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ ok: false }, { status: 401 });

  const login = (session as any).login as string | null;
  const localUsername = (session as any).localUsername as string | null;
  const identityKey = login || (localUsername ? `local:${localUsername}` : null);
  if (!identityKey) return Response.json({ ok: false });

  const userAgent = req.headers.get("user-agent");
  await checkAndRecordDevice(identityKey, userAgent);

  return Response.json({ ok: true });
}
