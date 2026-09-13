import { requestPasswordReset } from "@/lib/passwordReset";

export async function POST(req: Request) {
  const { identifier } = await req.json().catch(() => ({}));
  if (!identifier) {
    return Response.json({ error: "Username atau email wajib diisi." }, { status: 400 });
  }

  try {
    await requestPasswordReset(String(identifier).trim());
  } catch (e: any) {
    // CUMA rate-limit yang di-throw beneran dari requestPasswordReset (lihat
    // lib/passwordReset.ts) — kalau akunnya emang gak ketemu, fungsi itu
    // diem-diem aja (gak throw), jadi user gak bisa nebak akun mana yang
    // valid dari respons error/sukses.
    return Response.json({ error: e.message }, { status: 429 });
  }

  // SELALU balikin pesan sukses generik yang SAMA, gak peduli akunnya
  // ketemu atau nggak — ini mencegah "user enumeration" (orang gak bisa
  // nebak email/username mana yang kedaftar cuma dari respons API ini).
  return Response.json({
    ok: true,
    message: "Kalau akun dengan username/email itu ada, link reset udah dikirim ke emailnya.",
  });
}
