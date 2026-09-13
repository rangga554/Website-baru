import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { runSql } from "@/lib/dbConnections";

// Body: { sql }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login || !isOwner(login)) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { sql } = await req.json();
    const result = await runSql(params.id, sql);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
