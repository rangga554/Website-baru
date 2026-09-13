import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { approvePlusSubmission, rejectPlusSubmission } from "@/lib/plus";
import { sendPushToUser } from "@/lib/push";
import { logAction } from "@/lib/auditLog";

// Body: { action: 'approve', finalLogin, finalDays, note? }
//    or: { action: 'reject', note? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa konfirmasi Plus" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    if (body.action === "approve") {
      const result = await approvePlusSubmission({
        submissionId: params.id,
        finalLogin: body.finalLogin || "",
        finalDays: Number(body.finalDays),
        reviewedBy: login,
        note: body.note,
      });
      sendPushToUser(result.submission.final_login, {
        title: "KRYNOS Plus Aktif! 🎉",
        body: `Pengajuan kamu disetujui, Plus aktif ${result.submission.final_days} hari.`,
        url: "/plus",
      }).catch(() => {});
      logAction(login, "approve_plus", `Approve Plus buat ${result.submission.final_login} (${result.submission.final_days} hari)`);
      return Response.json({ ok: true, expiresAt: result.expiresAt });
    }

    if (body.action === "reject") {
      const rejected = await rejectPlusSubmission({
        submissionId: params.id,
        reviewedBy: login,
        note: body.note,
      });
      sendPushToUser(rejected.login, {
        title: "Pengajuan KRYNOS Plus Ditolak",
        body: body.note || "Cek lagi bukti transfernya, atau hubungi owner.",
        url: "/plus",
      }).catch(() => {});
      logAction(login, "reject_plus", `Reject pengajuan Plus dari ${rejected.login}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "action harus 'approve' atau 'reject'" }, { status: 400 });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
