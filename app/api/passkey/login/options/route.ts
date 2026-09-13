import { NextRequest } from "next/server";
import { findByUsernameOrEmail } from "@/lib/localAccounts";
import { buildAuthenticationOptions } from "@/lib/passkey";

export async function POST(req: NextRequest) {
  const { identifier } = await req.json();
  if (!identifier) return Response.json({ error: "Username/email wajib diisi" }, { status: 400 });

  const account = await findByUsernameOrEmail(identifier);
  // Sengaja pesan error-nya SAMA baik akun gak ketemu maupun akun belum
  // punya passkey — biar gak jadi celah buat nebak-nebak akun mana yang
  // valid (user enumeration).
  if (!account) {
    return Response.json({ error: "Akun gak ketemu atau belum punya passkey terdaftar." }, { status: 400 });
  }

  try {
    const options = await buildAuthenticationOptions(account.id);
    return Response.json({ options, localAccountId: account.id });
  } catch {
    return Response.json({ error: "Akun gak ketemu atau belum punya passkey terdaftar." }, { status: 400 });
  }
}
