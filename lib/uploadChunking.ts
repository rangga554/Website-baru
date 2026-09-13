// Deteksi kecepatan koneksi lewat Network Information API (didukung Chrome/
// Android; Safari/iOS belum dukung — otomatis fallback ke "medium" biar
// tetap aman, gak terlalu agresif atau terlalu lambat).
export type ConnectionQuality = "slow" | "medium" | "fast";

export function detectConnectionQuality(): ConnectionQuality {
  if (typeof navigator === "undefined") return "medium";
  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  if (!conn) return "medium";
  if (conn.saveData) return "slow"; // user aktifin mode hemat data -> anggap sinyal terbatas

  const type = conn.effectiveType as string | undefined;
  if (type === "slow-2g" || type === "2g") return "slow";
  if (type === "3g") return "medium";
  if (type === "4g") return "fast";

  // Fallback pakai downlink (Mbps) kalau effectiveType gak ada di browser ini
  if (typeof conn.downlink === "number") {
    if (conn.downlink < 1) return "slow";
    if (conn.downlink < 5) return "medium";
    return "fast";
  }
  return "medium";
}

// Batas jumlah file & total ukuran (base64) per batch — makin lambat sinyal,
// makin kecil batch-nya, biar 1 request gak gampang "kepotong" koneksi.
//
// PENTING soal maxBytes: Vercel Serverless Functions punya batas KERAS
// ukuran body request ~4.5MB (gak bisa dinaikin lewat config apapun, beda
// sama bodyParser limit di Pages Router lama). Kalau batch base64 + JSON
// overhead (path per file, dll) kelewat itu, GitHub/Vercel balikin HTTP 413
// (Payload Too Large) — BUKAN soal sinyal, jadi retry berkali-kali pun gak
// akan pernah berhasil. Nilai di bawah ini SENGAJA dikasih headroom cukup
// jauh di bawah 4.5MB (bukan cuma buat sinyal, tapi buat ngehindarin 413
// dari awal).
export function chunkParamsFor(quality: ConnectionQuality) {
  switch (quality) {
    case "slow":
      return { maxFiles: 5, maxBytes: 1 * 1024 * 1024 };
    case "medium":
      return { maxFiles: 10, maxBytes: 2 * 1024 * 1024 };
    case "fast":
    default:
      return { maxFiles: 20, maxBytes: 3 * 1024 * 1024 };
  }
}

// Pecah daftar file jadi beberapa batch, berhenti nambah ke batch yang
// sama begitu salah satu limit (jumlah file ATAU ukuran) kelampauan. 1 file
// yang sendirian aja udah lebih besar dari maxBytes tetap dapet batch-nya
// sendiri (gak nyangkut/gagal).
export function splitIntoChunks<T extends { content: string }>(
  items: T[],
  maxFiles: number,
  maxBytes: number
): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (const item of items) {
    const itemBytes = item.content.length;
    const wouldExceed =
      current.length > 0 &&
      (current.length >= maxFiles || currentBytes + itemBytes > maxBytes);

    if (wouldExceed) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += itemBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  slow: "lambat",
  medium: "sedang",
  fast: "cepat",
};
