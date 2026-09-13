import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { finishRegistration } from "@/lib/passkey";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;
  const accountType = (session as any)?.accountType as string | undefined;

  if (!localId || accountType !== "local") {
    return Response.json({ error: "Belum login sebagai akun lokal" }, { status: 400 });
  }

  const { response, deviceName } = await req.json();
  if (!response) return Response.json({ error: "Data dari browser gak lengkap" }, { status: 400 });

  try {
    const result = await finishRegistration(localId, response, deviceName);
    if (!result.verified) {
      return Response.json({ error: "Verifikasi passkey gagal, coba lagi." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
