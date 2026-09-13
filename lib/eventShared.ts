// File ini SENGAJA dipisah dari lib/event.ts — isinya harus 100% aman
// diimport dari komponen client ("use client"), sama kayak pola
// lib/plusShared.ts. JANGAN import lib/supabase.ts atau lib/push.ts di sini.

export type EventSettings = {
  active: boolean;
  hutNumber: number;
  startedAt: string | null;
  endsAt: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

// Status ringkas yang dipakai halaman publik (banner) & KRYNOS Plus —
// gak perlu tau detail jadwal, cukup tau lagi aktif apa enggak + HUT ke berapa.
export type EventPublicStatus = {
  active: boolean;
  hutNumber: number;
};

export function eventBannerMessage(hutNumber: number): string {
  return `Dirgahayu Republik Indonesia ke-${hutNumber}! KRYNOS Plus GRATIS buat semua selama event berlangsung.`;
}

// "3 hari 4 jam" / "5 jam 12 menit" / "Kurang dari 1 menit" — dipakai buat
// nampilin sisa waktu event (kalau ends_at di-set) di Event Panel & banner.
export function formatEventRemaining(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Sudah habis";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}
