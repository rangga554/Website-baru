import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan — lihat supabase_schema.txt bagian
// "ACTIVITY LOGS":
//
// create table activity_logs (
//   id uuid primary key default gen_random_uuid(),
//   actor_login text not null,
//   action text not null,
//   detail text,
//   created_at timestamptz not null default now()
// );
// ============================================================================

const TABLE = "activity_logs";

export type ActivityLog = {
  id: string;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

// Dipanggil abis aksi admin/owner/redeem BERHASIL. Sengaja gagal-diam
// (fire-and-forget, gak nge-throw) — logging gak boleh gagalin aksi
// utamanya sendiri, dan gak boleh bikin app error kalau tabelnya belum
// dimigrasi.
export function logAction(actorLogin: string, action: string, detail?: string) {
  try {
    const supabase = getSupabaseAdmin();
    supabase
      .from(TABLE)
      .insert({ actor_login: actorLogin, action, detail: detail || null })
      .then(() => {});
  } catch {
    // diem-diem aja, jangan sampai ganggu aksi utama
  }
}

export async function listActivityLogs(limit = 100): Promise<ActivityLog[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, actor_login, action, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal ambil activity logs: ${error.message}`);
  return data || [];
}
