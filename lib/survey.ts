import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// KOTAK SARAN (sebelumnya "Survey" pakai rating bintang — sekarang diganti
// jadi cuma teks saran/masukan, tanpa bintang). Tabel Supabase yang
// dibutuhkan ada di supabase_schema.txt (section "SURVEY -> KOTAK SARAN").
// Nama tabel & kolom lama (survey_responses, week_key, dst) SENGAJA
// dipertahanin apa adanya (bukan di-rename) biar gak perlu migrasi data,
// cuma kolom `rating` sekarang nullable & gak diisi lagi buat submission
// baru — data rating dari user yang isi pas masih fitur lama tetap ada.
//
// Constraint unique(login, week_key) itu yang bikin "1 akun cuma boleh isi
// 1x per minggu" dijamin di level database, bukan cuma di UI — jadi biarpun
// ada 2 request submit yang lolos validasi FE bersamaan, cuma 1 yang beneran
// kesimpen (yang kedua bakal gagal karena bentrok unique constraint).
// ============================================================================

const TABLE = "survey_responses";

export type SurveyResponse = {
  id: string;
  login: string;
  avatar_url: string | null;
  week_key: string;
  rating: number | null; // udah gak dipakai lagi buat submission BARU (lihat SurveySubmission) — kolom dibiarin nullable buat data lama
  reason: string; // isi saran/masukan user
  created_at: string;
};

export type SurveySubmission = {
  reason: string;
};

// Kunci minggu berbasis ISO 8601 (Senin = awal minggu), format "2026-W30".
// Dipakai biar "reset tiap minggu" konsisten dan gak bentrok pas gonta-ganti
// timezone user (dihitung di UTC).
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Senin = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // geser ke Kamis minggu ini
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Kapan minggu berjalan berakhir (Senin depan jam 00:00 UTC) — dipakai buat
// nampilin "reset lagi pada ..." di halaman survey.
export function getWeekResetAt(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Senin = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 7); // Senin minggu depan
  return d.toISOString();
}

export async function getMySurveyStatus(login: string) {
  const weekKey = getWeekKey();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, rating, reason, created_at")
    .eq("login", login)
    .eq("week_key", weekKey)
    .maybeSingle();

  if (error) throw new Error(`Gagal cek status survey: ${error.message}`);

  return {
    weekKey,
    resetAt: getWeekResetAt(),
    answered: !!data,
    myResponse: data || null,
  };
}

export async function submitSurvey(
  login: string,
  avatarUrl: string | null,
  submission: SurveySubmission
) {
  const weekKey = getWeekKey();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from(TABLE).insert({
    login,
    avatar_url: avatarUrl,
    week_key: weekKey,
    reason: submission.reason.trim(),
  });

  if (error) {
    // 23505 = unique_violation -> orangnya udah pernah isi minggu ini
    if ((error as any).code === "23505") {
      throw new Error("ALREADY_ANSWERED");
    }
    throw new Error(`Gagal simpan survey: ${error.message}`);
  }

  return { weekKey };
}

// Daftar respon minggu berjalan buat halaman /survey/live, terbaru duluan.
export async function listSurveyResponses(limit = 100): Promise<{
  weekKey: string;
  responses: SurveyResponse[];
}> {
  const weekKey = getWeekKey();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("week_key", weekKey)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal ambil data survey: ${error.message}`);

  return { weekKey, responses: (data as SurveyResponse[]) || [] };
}
