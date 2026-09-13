import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { getEventSettings, updateEventSettings } from "@/lib/event";
import { logAction } from "@/lib/auditLog";

// SENGAJA pakai isOwner langsung (BUKAN isOwnerOrAdmin) di seluruh file ini
// — atur event kemerdekaan (aktif/mati, notif massal ke semua user, dll)
// adalah hak eksklusif OWNER, admin gak boleh megang ini.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa buka Event Panel" }, { status: 403 });
  }

  try {
    const settings = await getEventSettings();
    return Response.json(settings);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body (semua field opsional, kirim yang mau diubah aja):
// {
//   hutNumber?: number,
//   activateNow?: boolean,
//   deactivateNow?: boolean,        // "stop langsung"
//   clearSchedule?: boolean,
//   durationHours?: number | null,  // null = tanpa batas waktu
//   scheduledStartAt?: string | null,
//   scheduledEndAt?: string | null,
// }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa ubah pengaturan event" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    const settings = await updateEventSettings({
      by: login,
      hutNumber: typeof body.hutNumber === "number" ? body.hutNumber : undefined,
      activateNow: !!body.activateNow,
      deactivateNow: !!body.deactivateNow,
      clearSchedule: !!body.clearSchedule,
      durationHours:
        body.durationHours === undefined
          ? undefined
          : body.durationHours === null
          ? null
          : Number(body.durationHours),
      scheduledStartAt: body.scheduledStartAt === undefined ? undefined : body.scheduledStartAt,
      scheduledEndAt: body.scheduledEndAt === undefined ? undefined : body.scheduledEndAt,
    });

    let action = "event_update";
    let detail = `HUT ke-${settings.hutNumber}`;
    if (body.activateNow) {
      action = "event_activate";
      detail = `Aktifkan event HUT ke-${settings.hutNumber} sekarang${
        settings.endsAt ? ` (sampai ${settings.endsAt})` : " (tanpa batas waktu)"
      }`;
    } else if (body.deactivateNow) {
      action = "event_deactivate";
      detail = `Matikan event HUT ke-${settings.hutNumber} sekarang`;
    } else if (body.scheduledStartAt !== undefined || body.scheduledEndAt !== undefined) {
      action = "event_schedule";
      detail = `Jadwal event: mulai ${settings.scheduledStartAt || "-"}, selesai ${
        settings.scheduledEndAt || "-"
      }`;
    }
    logAction(login, action, detail);

    return Response.json(settings);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
