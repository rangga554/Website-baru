import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildRegistrationOptions } from "@/lib/passkey";

export async function GET() {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;
  const accountType = (session as any)?.accountType as string | undefined;

  if (!localId || accountType !== "local") {
    return Response.json(
      { error: "Passkey cuma bisa dipasang ke akun lokal (username/password), bukan akun GitHub." },
      { status: 400 }
    );
  }

  try {
    const options = await buildRegistrationOptions(localId);
    return Response.json(options);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
