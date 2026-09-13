import { getSupabaseAdmin } from "./supabase";
import { broadcastPush } from "./push";
import type { EventSettings } from "./eventShared";

// ============================================================================
// Tabel Supabase yang dibutuhkan (lihat supabase_schema.txt bagian 10):
//   event_settings (1 baris, id = 1)
// ============================================================================

const TABLE = "event_settings";
const HOUR_MS = 60 * 60 * 1000;

type Row = {
  id: number;
  active: boolean;
  hut_number: number;
  started_at: string | null;
  ends_at: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  notified_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

function toSettings(row: Row): EventSettings {
  return {
    active: row.active,
    hutNumber: row.hut_number,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

async function fetchRow(): Promise<Row> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Gagal ambil pengaturan event: ${error.message}`);
  if (data) return data as Row;

  // Belum pernah di-setup -> bikin baris default (harusnya udah keinsert
  // lewat migration di supabase_schema.txt, ini cuma jaga-jaga).
  const { data: created, error: insertErr } = await supabase
    .from(TABLE)
    .insert({ id: 1, active: false, hut_number: 81 })
    .select()
    .single();
  if (insertErr) throw new Error(`Gagal bikin pengaturan event: ${insertErr.message}`);
  return created as Row;
}

async function notifyEventStarted(row: Row) {
  await broadcastPush("announcement", {
    title: `🇮🇩 Event Kemerdekaan Indonesia ke-${row.hut_number} Dimulai!`,
    body: "KRYNOS Plus GRATIS buat semua selama event berlangsung. Yuk buka aplikasinya! 🎉",
    url: "/dashboard",
  });
}

// Pengecekan "lazy" (dipanggil tiap ada yang baca status) buat 2 hal:
//   1) Jadwal auto-mulai (scheduled_start_at) udah lewat -> aktifin event +
//      kirim notif ke semua user, sekali doang per aktivasi.
//   2) Event yang lagi aktif udah lewat batas waktunya (ends_at) -> matiin
//      otomatis.
// Sama persis polanya kayak ensureCommentReset di lib/announcements.ts.
async function tick(row: Row): Promise<Row> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  let changed = false;
  const patch: Partial<Row> = {};

  if (!row.active && row.scheduled_start_at && new Date(row.scheduled_start_at).getTime() <= now) {
    const scheduledEnd = row.scheduled_end_at;
    if (!scheduledEnd || new Date(scheduledEnd).getTime() > now) {
      patch.active = true;
      patch.started_at = new Date(now).toISOString();
      patch.ends_at = scheduledEnd || null;
      patch.scheduled_start_at = null;
      patch.scheduled_end_at = null;
      changed = true;
    }
  } else if (row.active && row.ends_at && new Date(row.ends_at).getTime() <= now) {
    patch.active = false;
    patch.started_at = null;
    patch.ends_at = null;
    changed = true;
  }

  if (!changed) return row;

  const merged: Row = { ...row, ...patch };

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error) throw new Error(`Gagal update pengaturan event: ${error.message}`);

  // Baru transisi nonaktif -> aktif (via jadwal) -> kirim notif, kalau
  // belum pernah dikirim buat aktivasi kali ini.
  if (
    merged.active &&
    (!merged.notified_at || new Date(merged.notified_at).getTime() < new Date(merged.started_at!).getTime())
  ) {
    await notifyEventStarted(merged);
    await supabase.from(TABLE).update({ notified_at: new Date().toISOString() }).eq("id", 1);
    merged.notified_at = new Date().toISOString();
  }

  return (updated as Row) || merged;
}

export async function getEventSettings(): Promise<EventSettings> {
  const row = await tick(await fetchRow());
  return toSettings(row);
}

// Dipakai lib/plus.ts buat nentuin Plus gratis massal — sengaja ringkas
// (gak butuh detail jadwal).
export async function isEventActive(): Promise<{ active: boolean; hutNumber: number }> {
  const settings = await getEventSettings();
  return { active: settings.active, hutNumber: settings.hutNumber };
}

export type UpdateEventParams = {
  by: string;
  hutNumber?: number;
  activateNow?: boolean;
  deactivateNow?: boolean;
  clearSchedule?: boolean;
  durationHours?: number | null; // dipakai bareng activateNow ATAU buat ubah durasi event yg lagi jalan. null = tanpa batas waktu.
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
};

// Satu-satunya pintu masuk buat OWNER ubah pengaturan event. Semua aksi
// (aktifkan sekarang, matikan sekarang, ganti HUT ke berapa, atur durasi,
// atur jadwal otomatis, hapus jadwal) lewat sini.
export async function updateEventSettings(params: UpdateEventParams): Promise<EventSettings> {
  const supabase = getSupabaseAdmin();

  // Selesaiin dulu transisi otomatis yang mungkin ketinggalan (jadwal lewat/
  // durasi habis), biar aksi manual owner gak nabrak state basi.
  let row = await tick(await fetchRow());

  const patch: Partial<Row> = { updated_by: params.by, updated_at: new Date().toISOString() };

  if (typeof params.hutNumber === "number") {
    if (!Number.isFinite(params.hutNumber) || params.hutNumber <= 0) {
      throw new Error("HUT ke berapa harus angka positif");
    }
    patch.hut_number = Math.round(params.hutNumber);
  }

  if (params.deactivateNow) {
    patch.active = false;
    patch.started_at = null;
    patch.ends_at = null;
  }

  if (params.clearSchedule) {
    patch.scheduled_start_at = null;
    patch.scheduled_end_at = null;
  }

  if (params.activateNow) {
    const now = Date.now();
    patch.active = true;
    patch.started_at = new Date(now).toISOString();
    patch.ends_at =
      params.durationHours === undefined
        ? row.ends_at
        : params.durationHours === null
        ? null
        : new Date(now + params.durationHours * HOUR_MS).toISOString();
    patch.scheduled_start_at = null;
    patch.scheduled_end_at = null;
  } else if (params.durationHours !== undefined && (row.active || patch.active)) {
    // Ubah durasi event yang LAGI JALAN (perpanjang/perpendek dari waktu mulai).
    const base = row.started_at ? new Date(row.started_at).getTime() : Date.now();
    patch.ends_at =
      params.durationHours === null ? null : new Date(base + params.durationHours * HOUR_MS).toISOString();
  }

  if (!params.activateNow && params.scheduledStartAt !== undefined) {
    patch.scheduled_start_at = params.scheduledStartAt;
  }
  if (!params.activateNow && params.scheduledEndAt !== undefined) {
    patch.scheduled_end_at = params.scheduledEndAt;
  }

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error) throw new Error(`Gagal update pengaturan event: ${error.message}`);

  row = updated as Row;

  // Baru aktif LANGSUNG (tombol "Aktifkan Sekarang") -> notif semua user,
  // sama kayak aktivasi via jadwal, sekali per aktivasi.
  if (
    params.activateNow &&
    (!row.notified_at || new Date(row.notified_at).getTime() < new Date(row.started_at!).getTime())
  ) {
    await notifyEventStarted(row);
    const notifiedAt = new Date().toISOString();
    await supabase.from(TABLE).update({ notified_at: notifiedAt }).eq("id", 1);
    row = { ...row, notified_at: notifiedAt };
  }

  return toSettings(row);
}
