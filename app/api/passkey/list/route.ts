import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPasskeysForAccount } from "@/lib/passkey";

export async function GET() {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;
  const accountType = (session as any)?.accountType as string | undefined;

  if (!localId || accountType !== "local") {
    return Response.json({ passkeys: [] });
  }

  const passkeys = await listPasskeysForAccount(localId);
  return Response.json({ passkeys });
}
