import { NextRequest } from "next/server";
import { validateResetToken, resetPassword } from "@/lib/passwordReset";

// GET ?token=xxx -> cek token valid/nggak SEBELUM nampilin form password
// baru (biar user gak ngetik password dulu baru ketauan tokennya invalid).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return Response.json({ valid: false });

  const { valid, account } = await validateResetToken(token);
  return Response.json({ valid, username: valid ? account?.username : undefined });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) {
    return Response.json({ error: "Token dan password baru wajib diisi." }, { status: 400 });
  }

  try {
    await resetPassword(token, password);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal reset password." }, { status: 400 });
  }
}
