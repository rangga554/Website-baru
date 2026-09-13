import { getSupabaseAdmin } from "./supabase";

const BUCKET = "community-uploads";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
// Upload SEMBARANG jenis file (ZIP, PDF, APK, dll) buat dibagi di chat
// /komunitas. Sengaja dipisah dari uploadCommunityImage karena aturannya
// beda: nggak dibatasin tipe MIME, tapi batas ukurannya lebih kecil (3MB)
// soalnya base64 nambahin ~33% ukuran pas dikirim lewat JSON body, dan
// Vercel serverless function punya batas ukuran request ~4.5MB total.
const FILE_MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

export async function uploadCommunityFile(
  login: string,
  dataUrl: string,
  originalFilename: string
): Promise<{ url: string; size: number }> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Format file gak valid");

  const mimeType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > FILE_MAX_SIZE_BYTES) {
    throw new Error(
      `Ukuran file maksimal 3MB buat dikirim di Komunitas (batas server). File yang lebih besar, upload langsung ke repo aja lewat editor.`
    );
  }

  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
  const path = `files/${login.replace(/[^a-zA-Z0-9_-]/g, "_")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Gagal upload file: ${error.message}. Pastikan bucket "${BUCKET}" udah dibuat di Supabase Storage (public).`
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, size: buffer.length };
}

// Bucket TERPISAH & PRIVATE khusus bukti transfer KRYNOS Plus — jangan
// pernah disatuin sama "community-uploads" yang public, soalnya isinya bukti
// TF + kemungkinan info rekening yang gak boleh diakses sembarang orang.
const PROOF_BUCKET = "plus-proofs";
const PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const PROOF_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Upload bukti transfer (base64 data URL) ke bucket PRIVATE, balikin cuma
// path-nya (bukan URL publik, soalnya emang gak ada URL publiknya).
export async function uploadPlusProof(
  login: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Format bukti transfer gak valid (harus gambar)");

  const mimeType = match[1];
  if (!PROOF_ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Tipe gambar gak didukung (cuma PNG/JPEG/WEBP)");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > PROOF_MAX_SIZE_BYTES) {
    throw new Error("Ukuran bukti transfer maksimal 5MB");
  }

  const ext = mimeType.split("/")[1];
  const path = `${login.replace(/[^a-zA-Z0-9_-]/g, "_")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Gagal upload bukti transfer: ${error.message}. Pastikan bucket "${PROOF_BUCKET}" udah dibuat di Supabase Storage (PRIVATE, bukan public).`
    );
  }

  return path;
}

// Owner-only: bikin signed URL sementara (5 menit) buat lihat/download bukti
// transfer. Sengaja expire cepat, jangan disimpan/dibagikan linknya.
export async function getPlusProofSignedUrl(path: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, 60 * 5);
  if (error || !data) {
    throw new Error(`Gagal ambil bukti transfer: ${error?.message || "unknown error"}`);
  }
  return data.signedUrl;
}


// Terima gambar dalam bentuk base64 data URL (dari <input type="file"> di
// browser), upload ke Supabase Storage, balikin URL publiknya.
export async function uploadCommunityImage(
  login: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Format gambar gak valid");

  const mimeType = match[1];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Tipe gambar gak didukung (cuma PNG/JPEG/GIF/WEBP)");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error("Ukuran gambar maksimal 5MB");
  }

  const ext = mimeType.split("/")[1];
  const filename = `${login.replace(/[^a-zA-Z0-9_-]/g, "_")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Gagal upload gambar: ${error.message}. Pastikan bucket "${BUCKET}" udah dibuat di Supabase Storage (public).`
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// Upload musik/audio (MP3, WAV, OGG, M4A, WEBM audio) buat dibagi di chat
// /komunitas — sama persis pola-nya kayak uploadCommunityImage, cuma beda
// whitelist MIME. Sengaja limit 3MB (bukan 5MB kayak gambar) biar konsisten
// sama uploadCommunityFile: base64 nambah ~33% ukuran, dan Vercel serverless
// function punya batas total request body ~4.5MB.
const AUDIO_BUCKET = BUCKET; // bucket sama, folder beda (lihat path di bawah)
const AUDIO_MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
const AUDIO_ALLOWED_TYPES = [
  "audio/mpeg", // .mp3
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4", // .m4a
  "audio/x-m4a",
  "audio/webm",
  "audio/aac",
];

export async function uploadCommunityAudio(
  login: string,
  dataUrl: string,
  originalFilename?: string
): Promise<{ url: string; size: number }> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Format musik gak valid");

  const mimeType = match[1];
  if (!AUDIO_ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Tipe musik gak didukung (cuma MP3/WAV/OGG/M4A/WEBM/AAC)");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > AUDIO_MAX_SIZE_BYTES) {
    throw new Error("Ukuran musik maksimal 3MB buat dikirim di Komunitas (batas server)");
  }

  const ext = (originalFilename?.split(".").pop() || mimeType.split("/")[1] || "audio").replace(
    /[^a-zA-Z0-9]/g,
    ""
  );
  const path = `audio/${login.replace(/[^a-zA-Z0-9_-]/g, "_")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext || "mp3"}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Gagal upload musik: ${error.message}. Pastikan bucket "${AUDIO_BUCKET}" udah dibuat di Supabase Storage (public).`
    );
  }

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, size: buffer.length };
}
