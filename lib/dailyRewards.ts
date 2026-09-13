import { getSupabaseAdmin } from "./supabase";
import { grantPlusMinutes } from "./plus";

// ============================================================================
// DAILY REWARDS — ikon api di sidebar. "Hari" dihitung pake tanggal WIB
// (Asia/Jakarta) buat SEMUA user, gak peduli mereka di zona waktu mana —
// biar konsisten & gak ambigu (kalau ikut timezone device masing-masing,
// orang bisa "curang" ganti-ganti timezone HP buat check-in 2x sehari).
// ============================================================================

const TABLE = "daily_checkins";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_REWARD_MINUTES = 30;
const MAX_REWARD_MINUTES = 60;

function wibDateString(date: Date): string {
  // en-CA locale formatnya udah YYYY-MM-DD persis, tinggal pake timeZone
  // Asia/Jakarta biar hasilnya tanggal WIB, bukan tanggal server (UTC).
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function todayWIB(): string {
  return wibDateString(new Date());
}

function yesterdayWIB(): string {
  return wibDateString(new Date(Date.now() - MS_PER_DAY));
}

export type CheckinStatus = {
  streak: number;
  checkedInToday: boolean;
  lastCheckinDate: string | null; // 'YYYY-MM-DD' WIB, null kalau belum pernah/streak putus
};

export async function getCheckinStatus(login: string): Promise<CheckinStatus> {
  const safeLogin = login.trim().toLowerCase();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("streak, last_checkin_date")
    .eq("login", safeLogin)
    .maybeSingle();
  if (error) throw new Error(`Gagal ambil status check-in: ${error.message}`);

  if (!data) return { streak: 0, checkedInToday: false, lastCheckinDate: null };

  const today = todayWIB();
  const yesterday = yesterdayWIB();

  // Streak yang kesimpen di DB itu "streak per tanggal terakhir check-in" —
  // kalau ternyata udah lebih dari 1 hari lewat sejak itu (bukan hari ini
  // ATAU kemarin), berarti streak-nya UDAH PUTUS walau user belum check-in
  // lagi buat "resmi" ngenolin di database. Ditampilin 0 di UI (jujur ke
  // user), tapi baris DB-nya baru bener-bener di-overwrite pas dia check-in
  // berikutnya (di situ kejadian reset-nya).
  if (data.last_checkin_date !== today && data.last_checkin_date !== yesterday) {
    return { streak: 0, checkedInToday: false, lastCheckinDate: null };
  }

  return {
    streak: data.streak,
    checkedInToday: data.last_checkin_date === today,
    lastCheckinDate: data.last_checkin_date,
  };
}

export async function performCheckin(login: string): Promise<
  | { alreadyCheckedIn: true; streak: number }
  | { alreadyCheckedIn: false; streak: number; minutesGranted: number; expiresAt: string }
> {
  const safeLogin = login.trim().toLowerCase();
  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchErr } = await supabase
    .from(TABLE)
    .select("streak, last_checkin_date")
    .eq("login", safeLogin)
    .maybeSingle();
  if (fetchErr) throw new Error(`Gagal cek status check-in: ${fetchErr.message}`);

  const today = todayWIB();
  const yesterday = yesterdayWIB();

  if (existing?.last_checkin_date === today) {
    return { alreadyCheckedIn: true, streak: existing.streak };
  }

  const newStreak = existing?.last_checkin_date === yesterday ? existing.streak + 1 : 1;

  const { error: upsertErr } = await supabase.from(TABLE).upsert({
    login: safeLogin,
    streak: newStreak,
    last_checkin_date: today,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) throw new Error(`Gagal simpan check-in: ${upsertErr.message}`);

  const minutesGranted = Math.floor(
    MIN_REWARD_MINUTES + Math.random() * (MAX_REWARD_MINUTES - MIN_REWARD_MINUTES + 1)
  );
  const { expiresAt } = await grantPlusMinutes(safeLogin, minutesGranted);

  return { alreadyCheckedIn: false, streak: newStreak, minutesGranted, expiresAt };
}
