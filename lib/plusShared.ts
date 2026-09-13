// File ini SENGAJA dipisah dari lib/plus.ts — isinya harus 100% aman
// diimport dari komponen client ("use client"), jadi TIDAK BOLEH ada
// import apapun yang menyentuh lib/supabase.ts (service role key) di sini.

export const PLUS_PRICE_PER_WEEK_IDR = 10000;

// Hitung berapa hari Plus yang didapat dari nominal transfer.
// Aturan: kelipatan 10k = 1 minggu (7 hari). Di bawah 10k = 0 (gak kehitung).
// Sisa nominal yang gak genap kelipatan 10k HANGUS, gak dibawa ke submission
// berikutnya.
export function computeDaysFromAmount(amountIdr: number): number {
  if (!Number.isFinite(amountIdr) || amountIdr < PLUS_PRICE_PER_WEEK_IDR) return 0;
  const weeks = Math.floor(amountIdr / PLUS_PRICE_PER_WEEK_IDR);
  return weeks * 7;
}
