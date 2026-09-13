import { getSupabaseAdmin } from "@/lib/supabase";

// Publik (gak perlu login) — cuma balikin daftar USERNAME admin, bukan
// data lain (added_by, created_at, dll). Dipakai komponen RoleBadge di
// client buat nentuin siapa yang dapet label [ADMIN🛡️] di samping nama,
// tanpa perlu fetch API per-username satu-satu.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("app_admins").select("login");
    if (error) throw error;
    return Response.json({ logins: (data || []).map((d) => d.login.toLowerCase()) });
  } catch {
    // Supabase/tabel belum disetup -> gagal-terbuka jadi list kosong, biar
    // gak bikin halaman lain ikut error gara-gara fitur badge ini.
    return Response.json({ logins: [] });
  }
}
