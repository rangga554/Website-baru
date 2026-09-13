import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";
import { recordSecurityNotification } from "./securityNotifications";

// ============================================================================
// DETEKSI PERANGKAT BARU — dipanggil sekali tiap ada sign-in beneran
// (bukan tiap refresh token) dari lib/auth.ts. Fingerprint-nya dari
// User-Agent doang (bukan IP — biar gak kena masalah IP dinamis/rotating
// yang bikin 1 device kedetect "baru" tiap hari), jadi ini deteksi
// KASAR: 2 device beda merek tapi browser+OS sama PERSIS bisa keanggep
// "device yang sama". Cukup buat kasih heads-up ke user, bukan security
// tracking presisi tinggi.
// ============================================================================

function fingerprintUserAgent(userAgent: string): string {
  return crypto.createHash("sha256").update(userAgent.trim().toLowerCase()).digest("hex");
}

// Parser User-Agent RINGAN (bukan library eksternal) — cukup buat label
// yang gampang dibaca kayak "Chrome di Android", gak perlu presisi 100%.
export function labelUserAgent(userAgent: string): string {
  const ua = userAgent || "";
  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";

  let os = "";
  if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "Mac";
  else if (/linux/i.test(ua)) os = "Linux";

  return os ? `${browser} di ${os}` : browser;
}

// Balikin true kalau ini device BARU (belum pernah dipakai buat identityKey
// ini) — upsert last_seen kalau udah ada, insert + catet notifikasi kalau
// baru. Fire-and-forget friendly — gak throw, best-effort.
export async function checkAndRecordDevice(identityKey: string, userAgent: string | null) {
  if (!userAgent) return;

  try {
    const fingerprint = fingerprintUserAgent(userAgent);
    const label = labelUserAgent(userAgent);
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("known_devices")
      .select("id")
      .eq("identity_key", identityKey)
      .eq("device_fingerprint", fingerprint)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("known_devices")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", existing.id);
      return;
    }

    await supabase.from("known_devices").insert({
      identity_key: identityKey,
      device_fingerprint: fingerprint,
      device_label: label,
    });

    await recordSecurityNotification(
      identityKey,
      "new_device",
      `Ada login baru dari perangkat: ${label}. Kalau bukan kamu, segera ganti password.`
    );
  } catch {
    // Best-effort — kegagalan di sini gak boleh ganggu proses login.
  }
}
