import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase TAMBAHAN yang dibutuhkan (jalankan sekali di SQL Editor,
// terpisah dari tabel survey_responses yang sudah ada):
//
// create table user_activity (
//   login text primary key,
//   avatar_url text,
//   first_seen timestamptz not null default now(),
//   last_seen timestamptz not null default now(),
//   total_active_seconds bigint not null default 0
// );
//
// - "first_seen" = pertama kali akun itu kebaca aktif -> dasar hitung
//   "Jumlah User Terdaftar".
// - "last_seen" ke-update tiap ping -> dasar hitung "Jumlah User Aktif" &
//   "Rata-Rata Jumlah User Aktif Bulanan".
// - "total_active_seconds" nambah tiap ping (client ping tiap PING_INTERVAL_
//   SECONDS detik SELAMA tab kebuka & aktif) -> dasar hitung "Rata-Rata
//   Waktu Pakai".
// ============================================================================

const TABLE = "user_activity";

// Harus sama persis dengan interval ping di components/ActivityTracker.tsx —
// dipakai buat nentuin berapa detik yang ditambahin tiap kali ping masuk.
export const PING_INTERVAL_SECONDS = 60;

// Dianggap "aktif" kalau last_seen dalam rentang ini.
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 jam -> "Jumlah User Aktif"
const MONTHLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari -> MAU

export async function recordActivityPing(login: string, avatarUrl: string | null) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from(TABLE)
    .select("total_active_seconds")
    .eq("login", login)
    .maybeSingle();

  if (selectError) throw new Error(`Gagal cek aktivitas user: ${selectError.message}`);

  if (!existing) {
    // Ping pertama dari akun ini: cuma daftarin, belum nambah waktu pakai
    // (biar gak dobel-hitung detik sebelum ping kedua bener-bener lewat).
    const { error } = await supabase.from(TABLE).insert({
      login,
      avatar_url: avatarUrl,
      first_seen: now,
      last_seen: now,
      total_active_seconds: 0,
    });
    if (error) throw new Error(`Gagal catat user baru: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from(TABLE)
    .update({
      avatar_url: avatarUrl,
      last_seen: now,
      total_active_seconds: existing.total_active_seconds + PING_INTERVAL_SECONDS,
    })
    .eq("login", login);

  if (error) throw new Error(`Gagal update aktivitas user: ${error.message}`);
}

export type OwnerStats = {
  totalRegisteredUsers: number;
  activeUsers: number;
  averageMonthlyActiveUsers: number;
  averageUsageSeconds: number;
  averageSurveyRespondentsPerWeek: number;
  newUsersLast7Days: number;
  bannedUsersCount: number;
  topActiveUsers: { login: string; avatar_url: string | null; total_active_seconds: number }[];
  totalCommunityMessages: number;
  totalAnnouncements: number;
  totalCollaborations: number;
};

export async function getOwnerStats(): Promise<OwnerStats> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();

  const { data: users, error: usersError } = await supabase
    .from(TABLE)
    .select("login, avatar_url, last_seen, first_seen, total_active_seconds");

  if (usersError) throw new Error(`Gagal ambil data user: ${usersError.message}`);

  const rows = users || [];
  const totalRegisteredUsers = rows.length;

  const activeUsers = rows.filter(
    (u) => now - new Date(u.last_seen).getTime() <= ACTIVE_WINDOW_MS
  ).length;

  const averageMonthlyActiveUsers = rows.filter(
    (u) => now - new Date(u.last_seen).getTime() <= MONTHLY_WINDOW_MS
  ).length;

  const averageUsageSeconds =
    totalRegisteredUsers === 0
      ? 0
      : Math.round(
          rows.reduce((sum, u) => sum + (u.total_active_seconds || 0), 0) /
            totalRegisteredUsers
        );

  // Rata-rata jumlah pengirim survey per minggu: hitung jumlah respon per
  // week_key, lalu rata-ratakan dari semua minggu yang pernah ada datanya.
  const { data: surveyRows, error: surveyError } = await supabase
    .from("survey_responses")
    .select("week_key");

  if (surveyError) throw new Error(`Gagal ambil data survey: ${surveyError.message}`);

  const perWeekCount = new Map<string, number>();
  for (const row of surveyRows || []) {
    perWeekCount.set(row.week_key, (perWeekCount.get(row.week_key) || 0) + 1);
  }
  const weekCounts = Array.from(perWeekCount.values());
  const averageSurveyRespondentsPerWeek =
    weekCounts.length === 0
      ? 0
      : Math.round(
          (weekCounts.reduce((sum, c) => sum + c, 0) / weekCounts.length) * 10
        ) / 10;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const newUsersLast7Days = rows.filter(
    (u: any) => now - new Date(u.first_seen).getTime() <= SEVEN_DAYS_MS
  ).length;

  const topActiveUsers = [...rows]
    .sort((a: any, b: any) => (b.total_active_seconds || 0) - (a.total_active_seconds || 0))
    .slice(0, 5)
    .map((u: any) => ({
      login: u.login,
      avatar_url: u.avatar_url,
      total_active_seconds: u.total_active_seconds || 0,
    }));

  // Query "banned" terpisah & gagal-terbuka (0) kalau kolomnya belum
  // dimigrasikan (lihat lib/userManagement.ts), biar statistik lain di atas
  // tetap muncul normal.
  let bannedUsersCount = 0;
  try {
    const { count } = await supabase
      .from(TABLE)
      .select("login", { count: "exact", head: true })
      .eq("banned", true);
    bannedUsersCount = count || 0;
  } catch {
    bannedUsersCount = 0;
  }

  const [communityCountRes, announcementCountRes, collabCountRes] = await Promise.all([
    supabase.from("community_messages").select("id", { count: "exact", head: true }),
    supabase.from("announcements").select("id", { count: "exact", head: true }),
    supabase.from("collaboration_invites").select("id", { count: "exact", head: true }).eq("status", "accepted"),
  ]);

  return {
    totalRegisteredUsers,
    activeUsers,
    averageMonthlyActiveUsers,
    averageUsageSeconds,
    averageSurveyRespondentsPerWeek,
    newUsersLast7Days,
    bannedUsersCount,
    topActiveUsers,
    totalCommunityMessages: communityCountRes.count || 0,
    totalAnnouncements: announcementCountRes.count || 0,
    totalCollaborations: collabCountRes.count || 0,
  };
}
