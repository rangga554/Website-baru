import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyRedeemCode } from "@/lib/redeem";
import { logAction } from "@/lib/auditLog";

// Body: { code }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  const body = await req.json().catch(() => null);
  if (!body?.code) return Response.json({ error: "Kode wajib diisi" }, { status: 400 });

  try {
    const result = await applyRedeemCode({
      codeInput: body.code,
      login,
      avatarUrl: avatar,
    });
    logAction(login, "use_redeem_code", `Pakai kode: ${body.code}`);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
