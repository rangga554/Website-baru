import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unlinkGithubAccount } from "@/lib/localAccounts";

// DELETE = lepas tautan GitHub dari akun lokal yang lagi login.
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;
  if (!localId) return Response.json({ error: "Cuma akun lokal yang bisa lepas tautan." }, { status: 401 });

  try {
    await unlinkGithubAccount(localId);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || "Gagal lepas tautan." }, { status: 400 });
  }
}
