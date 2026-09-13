import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { grantPlusFree } from "@/lib/plus";
import { logAction } from "@/lib/auditLog";

// Body: { login, days }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa kasih Plus gratis" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    const result = await grantPlusFree({
      login: body.login || "",
      days: Number(body.days),
      grantedBy: login,
    });
    logAction(login, "grant_plus_free", `Kasih Plus gratis ke ${body.login} (${body.days} hari)`);
    return Response.json({ ok: true, expiresAt: result.expiresAt });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
