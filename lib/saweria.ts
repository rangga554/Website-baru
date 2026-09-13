import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Integrasi Saweria (donasi otomatis -> Plus otomatis aktif, TANPA owner
// perlu approve manual).
//
// SETUP di akun Saweria (saweria.co/admin/integrations -> Webhook):
//   1. Isi "Webhook URL" dengan: https://domain-kamu.com/api/plus/saweria-webhook
//   2. Stream Key kamu (Saweria -> Stream -> Stream Key, atau di halaman
//      Integrations juga biasanya kelihatan) di-copy ke env var
//      SAWERIA_STREAM_KEY di project ini (JANGAN pernah expose ke client).
//   3. Isi juga NEXT_PUBLIC_SAWERIA_USERNAME dengan username Saweria kamu
//      (yang dipakai di URL https://saweria.co/<username>) — ini dipakai di
//      frontend buat bikin tombol "Donasi via Saweria".
//
// CARA KERJA MATCHING USER: Saweria gak punya kolom "user id" custom yang
// bisa kita titipin gitu aja — makanya user WAJIB nulis username GitHub
// KRYNOS mereka di kolom pesan/nama saat donasi. Begitu webhook masuk,
// kita pecah isi pesan jadi token per-kata, terus dicocokin ke tabel
// user_activity (semua login yang PERNAH login ke KRYNOS). Kalau ketemu
// PERSIS 1 kandidat -> otomatis di-approve. Kalau 0 atau lebih dari 1
// kandidat -> masuk antrian pending biasa (owner cocokin manual di Owner
// Panel, sama kayak submission QRIS manual selama ini) — jadi tetep ada
// fallback aman, gak ada donasi yang "ilang" gara-gara typo username.
// ============================================================================

const SIGNATURE_HEADER = "saweria-callback-signature";

export function isSaweriaConfigured(): boolean {
  return !!process.env.SAWERIA_STREAM_KEY;
}

// Verifikasi request BENERAN datang dari Saweria (bukan orang iseng nembak
// endpoint ini langsung buat ngasih diri sendiri Plus gratis). HMAC-SHA256
// dari raw body, pakai Stream Key sebagai secret, dibandingin secara
// constant-time (bukan `===` biasa) biar gak kena timing attack.
export function verifySaweriaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const streamKey = process.env.SAWERIA_STREAM_KEY;
  if (!streamKey || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", streamKey).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getSaweriaSignatureFromHeaders(headers: Headers): string | null {
  return headers.get(SIGNATURE_HEADER);
}

// Pecah pesan donasi jadi token (username GitHub cuma boleh alfanumerik +
// strip, jadi ini cukup buat misahin kata demi kata dari kalimat bebas).
function extractTokens(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9-]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((t) => t.toLowerCase()))).filter((t) => t.length >= 2);
}

// Cari SATU login KRYNOS yang cocok dari isi pesan donasi. Balikin null
// kalau gak ketemu sama sekali ATAU ketemu lebih dari 1 (ambigu) — di kedua
// kasus itu sengaja gak ditebak, biar aman (masuk antrian manual aja).
export async function matchLoginFromMessage(message: string): Promise<string | null> {
  const tokens = extractTokens(message || "");
  if (tokens.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_activity")
    .select("login")
    .in("login", tokens);
  if (error || !data || data.length === 0) return null;

  const uniqueLogins = Array.from(new Set(data.map((d) => d.login.toLowerCase())));
  if (uniqueLogins.length !== 1) return null;
  return uniqueLogins[0];
}
