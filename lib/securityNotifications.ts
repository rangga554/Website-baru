import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// NOTIFIKASI KEAMANAN — muncul di NotificationBell. Dicatat buat:
//   - 'password_changed' -> ganti password manual (dari Settings, BUKAN
//     lewat lupa password — lihat lib/passwordReset.ts)
//   - 'new_device'        -> login dari perangkat/browser yang belum
//     pernah dipakai buat akun ini sebelumnya
//
// SENGAJA GAK ADA 'password_reset' / 'forgot_password' di sini — sesuai
// permintaan, alur lupa password gak nulis apa-apa ke tabel ini.
//
// Dikunci pakai `identity_key` — sama kayak yang dipakai lib/identity.ts:
// login GitHub kalau sesi ini punya GitHub, atau "local:<username>" kalau
// akun lokal yang belum ditautkan ke GitHub.
// ============================================================================

const TABLE = "security_notifications";

export type SecurityNotification = {
  id: string;
  identity_key: string;
  type: "password_changed" | "new_device";
  message: string;
  created_at: string;
};

export async function recordSecurityNotification(
  identityKey: string,
  type: SecurityNotification["type"],
  message: string
) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from(TABLE).insert({ identity_key: identityKey, type, message });
  } catch {
    // Gagal nyimpen notifikasi keamanan gak boleh nge-gagalin aksi utamanya
    // (ganti password / login tetap harus jalan walau notifnya gagal kesimpen).
  }
}

export async function listSecurityNotifications(identityKey: string): Promise<SecurityNotification[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("identity_key", identityKey)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data as SecurityNotification[]) || [];
}
