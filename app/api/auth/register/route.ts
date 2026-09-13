import { registerLocalAccount } from "@/lib/localAccounts";
import { issueVerification } from "@/lib/emailVerification";

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json();
    if (!username || !email || !password) {
      return Response.json({ error: "Username, email, dan password wajib diisi." }, { status: 400 });
    }

    const account = await registerLocalAccount({ username, email, password });

    let emailSent = true;
    try {
      const result = await issueVerification({
        targetType: "local",
        targetId: account.id,
        email: account.email,
      });
      emailSent = result.sent;
    } catch (e: any) {
      // Akun tetep kebuat walau kirim email gagal — user bisa "Kirim ulang"
      // dari halaman /verify-email.
      emailSent = false;
    }

    return Response.json({
      ok: true,
      accountId: account.id,
      email: account.email,
      emailSent,
    });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal daftar akun." }, { status: 400 });
  }
}
