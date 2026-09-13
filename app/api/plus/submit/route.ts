import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitPlusPayment } from "@/lib/plus";
import { sendPushToUser } from "@/lib/push";
import { OWNER_LOGIN } from "@/lib/owner";

// Body: { proofDataUrl, senderName, amountIdr }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    const submission = await submitPlusPayment({
      login,
      avatarUrl: avatar,
      proofDataUrl: body.proofDataUrl,
      senderName: body.senderName || "",
      amountIdr: Number(body.amountIdr),
    });

    sendPushToUser(OWNER_LOGIN, {
      title: "Pengajuan KRYNOS Plus Baru",
      body: `${login} mengirim bukti transfer Rp${Number(body.amountIdr).toLocaleString("id-ID")}`,
      url: "/owner",
    }).catch(() => {});

    return Response.json({
      ok: true,
      id: submission.id,
      computedDays: submission.computed_days,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
