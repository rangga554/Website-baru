import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deletePasskey } from "@/lib/passkey";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;
  const accountType = (session as any)?.accountType as string | undefined;

  if (!localId || accountType !== "local") {
    return Response.json({ error: "Belum login sebagai akun lokal" }, { status: 400 });
  }

  const credentialId = req.nextUrl.searchParams.get("id");
  if (!credentialId) return Response.json({ error: "id wajib diisi" }, { status: 400 });

  await deletePasskey(localId, credentialId);
  return Response.json({ ok: true });
}
