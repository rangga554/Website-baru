import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listConnections, addConnection } from "@/lib/dbConnections";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login || !isOwner(login)) return null;
  return login;
}

export async function GET() {
  const login = await requireOwner();
  if (!login) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const list = await listConnections();
    return Response.json(list);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { name, connectionString }
export async function POST(req: NextRequest) {
  const login = await requireOwner();
  if (!login) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, connectionString } = await req.json();
    const connection = await addConnection(name, connectionString);
    return Response.json(connection);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
