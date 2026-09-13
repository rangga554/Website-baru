import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { createRedeemCode, listRedeemCodes } from "@/lib/redeem";
import { logAction } from "@/lib/auditLog";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa lihat daftar kode redeem" }, { status: 403 });
  }

  try {
    const data = await listRedeemCodes();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { code, rewardType, rewardDays?, rewardMessage?, maxUses, expiresAt? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa bikin kode redeem" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    const data = await createRedeemCode({
      code: body.code || "",
      rewardType: body.rewardType,
      rewardDays: body.rewardDays ? Number(body.rewardDays) : undefined,
      rewardMessage: body.rewardMessage,
      maxUses: Number(body.maxUses) || 1,
      expiresAt: body.expiresAt || null,
      createdBy: login,
    });
    logAction(login, "create_redeem_code", `Buat kode redeem: ${data.code}`);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
