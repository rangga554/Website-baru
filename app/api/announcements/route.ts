import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { listAnnouncements, createAnnouncement } from "@/lib/announcements";
import { broadcastPush } from "@/lib/push";
import { logAction } from "@/lib/auditLog";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await listAnnouncements();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { title, content } — khusus owner
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa buat pengumuman" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const announcement = await createAnnouncement({
      title: body.title,
      content: body.content,
      createdBy: login,
      avatarUrl: (session as any).avatar || null,
    });
    logAction(login, "create_announcement", `Buat pengumuman: ${announcement.title}`);

    // Notif ke SEMUA user yang subscribe — user biasa (scope "announcement")
    // maupun owner (scope "all", karena owner emang dapat semua jenis notif).
    const pushPayload = {
      title: "Pengumuman Baru: " + announcement.title,
      body: announcement.content.slice(0, 100),
      url: `/announcement/${announcement.id}`,
    };
    Promise.all([
      broadcastPush("announcement", pushPayload),
      broadcastPush("all", pushPayload),
    ]).catch(() => {});

    return Response.json(announcement);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
