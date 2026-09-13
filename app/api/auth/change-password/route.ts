import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findById, verifyPassword, updatePassword } from "@/lib/localAccounts";
import { recordSecurityNotification } from "@/lib/securityNotifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if ((session as any).accountType !== "local") {
    return Response.json(
      { error: "Ganti password cuma buat akun Username/Email — akun GitHub gak punya password di KRYNOS." },
      { status: 400 }
    );
  }

  const localId = (session as any).localId as string;
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return Response.json({ error: "Password lama dan password baru wajib diisi." }, { status: 400 });
  }

  const account = await findById(localId);
  if (!account) return Response.json({ error: "Akun gak ketemu." }, { status: 404 });

  const valid = await verifyPassword(account, currentPassword);
  if (!valid) return Response.json({ error: "Password lama salah." }, { status: 400 });

  try {
    await updatePassword(account.id, newPassword);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }

  // INI notifikasi keamanan yang beneran muncul (ganti password manual,
  // BEDA dari lupa password yang sengaja gak dicatat).
  await recordSecurityNotification(
    `local:${account.username}`,
    "password_changed",
    "Password akun kamu baru aja diganti. Kalau bukan kamu yang ganti, segera hubungi Owner lewat menu Message."
  );

  return Response.json({ ok: true });
}
