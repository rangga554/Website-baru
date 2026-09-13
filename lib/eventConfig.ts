// ============================================================================
// EVENT MODE — 🇮🇩 HUT RI ke-81 (17 Agustus 2026)
//
// SATU SAKLAR doang yang perlu diubah buat balikin semuanya ke normal:
// set EVENT_ACTIVE = false. Begitu itu di-set false:
//   - KRYNOS Plus balik jadi bayar lagi (getPlusStatus di lib/plus.ts
//     otomatis skip logika gratisan ini)
//   - Dekorasi merah-putih (banner + bunting) otomatis ilang dari semua
//     halaman (dirender lewat <IndependenceDayBanner /> di Providers.tsx)
//
// Gak perlu hapus/edit file lain sama sekali buat "balikin normal".
// ============================================================================

export const EVENT_ACTIVE = true;

export const EVENT_NAME = "HUT RI ke-81";
export const EVENT_TAGLINE = "Dirgahayu Republik Indonesia ke-81 🇮🇩";
export const EVENT_PLUS_MESSAGE =
  "KRYNOS Plus GRATIS buat semua selama event 17 Agustus berlangsung!";
