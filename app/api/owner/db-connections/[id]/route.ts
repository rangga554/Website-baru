import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { removeConnection } from "@/lib/dbConnections";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login || !isOwner(login)) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    await removeConnection(params.id);
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
