import { getSupabaseAdmin } from "./supabase";
import { uploadPlusProof, getPlusProofSignedUrl } from "./storage";
import { isOwner } from "./owner";
import { PLUS_PRICE_PER_WEEK_IDR, computeDaysFromAmount } from "./plusShared";
import { isEventActive } from "./event";

// ============================================================================
// Tabel Supabase yang dibutuhkan (lihat supabase_schema.txt bagian 5):
//   plus_subscriptions, plus_payment_submissions
// Plus bucket storage PRIVATE "plus-proofs" (lihat catatan di supabase_schema.txt)
// ============================================================================

const SUB_TABLE = "plus_subscriptions";
const SUBMISSION_TABLE = "plus_payment_submissions";

export { PLUS_PRICE_PER_WEEK_IDR, computeDaysFromAmount };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---- User-facing: submit bukti transfer ----------------------------------
export async function submitPlusPayment(params: {
  login: string;
  avatarUrl: string | null;
  proofDataUrl: string;
  senderName: string;
  amountIdr: number;
}) {
  const senderName = params.senderName.trim();
  if (!senderName) throw new Error("Nama rekening/e-wallet pengirim wajib diisi");
  if (!Number.isFinite(params.amountIdr) || params.amountIdr <= 0) {
    throw new Error("Jumlah transfer gak valid");
  }
  if (params.amountIdr < PLUS_PRICE_PER_WEEK_IDR) {
    throw new Error(
      `Minimal transfer Rp${PLUS_PRICE_PER_WEEK_IDR.toLocaleString("id-ID")} (di bawah itu gak kehitung / hangus)`
    );
  }

  const proofPath = await uploadPlusProof(params.login, params.proofDataUrl);
  const computedDays = computeDaysFromAmount(params.amountIdr);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      login: params.login,
      avatar_url: params.avatarUrl,
      proof_path: proofPath,
      sender_name: senderName,
      amount_idr: Math.round(params.amountIdr),
      computed_days: computedDays,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal mengirim bukti transfer: ${error.message}`);
  return data;
}

// Status Plus milik 1 akun. Owner selalu Plus otomatis (gratis, gak perlu bayar).
export async function getPlusStatus(login: string) {
  if (isOwner(login)) {
    return { active: true, isOwnerAccount: true, expiresAt: null as string | null, eventFree: false, hutNumber: null as number | null };
  }

  // Event HUT RI (diatur owner lewat Owner Panel -> Event Panel): kalau
  // lagi aktif, semua akun dianggap Plus aktif tanpa perlu bayar/submission.
  const event = await isEventActive();
  if (event.active) {
    return {
      active: true,
      isOwnerAccount: false,
      expiresAt: null as string | null,
      eventFree: true,
      hutNumber: event.hutNumber,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUB_TABLE)
    .select("expires_at")
    .eq("login", login)
    .maybeSingle();
  if (error) throw new Error(`Gagal cek status Plus: ${error.message}`);

  if (!data) return { active: false, isOwnerAccount: false, expiresAt: null, eventFree: false, hutNumber: null };

  const active = new Date(data.expires_at).getTime() > Date.now();
  return { active, isOwnerAccount: false, expiresAt: data.expires_at as string, eventFree: false, hutNumber: null };
}

export async function isPlusActive(login: string): Promise<boolean> {
  const status = await getPlusStatus(login);
  return status.active;
}

// ---- User-facing: riwayat submission MILIK SENDIRI (buat notifikasi
// in-app status approved/rejected — lihat NotificationBell.tsx) ------------
// Dicocokin dari 2 kolom sekaligus: `login` (submitter asli, kepake buat
// submission manual & Saweria yang KETEBAK username-nya) dan `final_login`
// (username yang di-set FINAL sama owner pas approve — kepake khusus buat
// donasi Saweria yang awalnya gak ke-match otomatis terus dicocokin manual
// belakangan, biar user itu tetep kebagian notifikasi statusnya).
export async function listMyPlusSubmissions(login: string, limit = 20) {
  const supabase = getSupabaseAdmin();
  const safeLogin = login.trim().toLowerCase();
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .select("id, status, computed_days, final_days, amount_idr, source, note, reviewed_at, created_at")
    .or(`login.eq.${safeLogin},final_login.eq.${safeLogin}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal ambil riwayat submission: ${error.message}`);
  return data || [];
}

// ---- Owner-only: review submission ----------------------------------------
export async function listPlusSubmissions(status?: "pending" | "approved" | "rejected") {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(SUBMISSION_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`Gagal ambil daftar submission: ${error.message}`);
  return data || [];
}

export async function getPlusSubmissionProofUrl(submissionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .select("proof_path")
    .eq("id", submissionId)
    .single();
  if (error || !data) throw new Error("Submission gak ditemukan");
  return getPlusProofSignedUrl(data.proof_path);
}

// Owner approve: bisa override username tujuan & jumlah hari (misal ada typo
// username, atau owner mau kasih bonus/potongan hari secara manual).
export async function approvePlusSubmission(params: {
  submissionId: string;
  finalLogin: string;
  finalDays: number;
  reviewedBy: string;
  note?: string;
}) {
  const finalLogin = params.finalLogin.trim().toLowerCase();
  if (!finalLogin) throw new Error("Username tujuan wajib diisi");
  if (!Number.isFinite(params.finalDays) || params.finalDays <= 0) {
    throw new Error("Jumlah hari Plus gak valid");
  }

  const supabase = getSupabaseAdmin();

  const { data: submission, error: subErr } = await supabase
    .from(SUBMISSION_TABLE)
    .select("*")
    .eq("id", params.submissionId)
    .single();
  if (subErr || !submission) throw new Error("Submission gak ditemukan");
  if (submission.status !== "pending") throw new Error("Submission ini udah diproses sebelumnya");

  // Perpanjang dari expiry yang lama kalau masih aktif, atau mulai dari
  // sekarang kalau udah expired / belum pernah Plus sama sekali.
  const { data: existing } = await supabase
    .from(SUB_TABLE)
    .select("expires_at")
    .eq("login", finalLogin)
    .maybeSingle();

  const now = Date.now();
  const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiresAt = new Date(base + params.finalDays * MS_PER_DAY).toISOString();

  const { error: upsertErr } = await supabase.from(SUB_TABLE).upsert({
    login: finalLogin,
    avatar_url: submission.avatar_url,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) throw new Error(`Gagal aktivasi Plus: ${upsertErr.message}`);

  const { data: updated, error: updateErr } = await supabase
    .from(SUBMISSION_TABLE)
    .update({
      status: "approved",
      final_login: finalLogin,
      final_days: params.finalDays,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      note: params.note || null,
    })
    .eq("id", params.submissionId)
    .select()
    .single();
  if (updateErr) throw new Error(`Gagal update submission: ${updateErr.message}`);

  return { submission: updated, expiresAt: newExpiresAt };
}

// Owner kasih Plus GRATIS ke siapa aja, tanpa perlu submission/bukti transfer
// sama sekali. Dipakai buat bagi-bagi/giveaway.
export async function grantPlusFree(params: {
  login: string;
  days: number;
  grantedBy: string;
}) {
  const login = params.login.trim().toLowerCase();
  if (!login) throw new Error("Username wajib diisi");
  if (!Number.isFinite(params.days) || params.days <= 0) {
    throw new Error("Jumlah hari gak valid");
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from(SUB_TABLE)
    .select("expires_at")
    .eq("login", login)
    .maybeSingle();

  const now = Date.now();
  const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiresAt = new Date(base + params.days * MS_PER_DAY).toISOString();

  const { error } = await supabase.from(SUB_TABLE).upsert({
    login,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Gagal kasih Plus gratis: ${error.message}`);

  // Dicatat juga di tabel submission (status langsung 'approved') biar ada
  // jejaknya di riwayat Owner Panel — bukan cuma diam-diam ubah expiry.
  await supabase.from(SUBMISSION_TABLE).insert({
    login,
    sender_name: "(gratis dari owner)",
    amount_idr: 0,
    computed_days: params.days,
    status: "approved",
    final_login: login,
    final_days: params.days,
    reviewed_by: params.grantedBy,
    reviewed_at: new Date().toISOString(),
    note: "Grant gratis oleh owner",
  });

  return { expiresAt: newExpiresAt };
}

// Sama pola-nya kayak grantPlusFree, tapi satuannya MENIT (bukan hari) —
// dipakai khusus buat reward Daily Rewards (30-60 menit per check-in).
// Sengaja GAK dicatet ke tabel plus_payment_submissions (beda konteks dari
// pembayaran/giveaway manual owner) — cukup nambah expires_at doang.
export async function grantPlusMinutes(login: string, minutes: number): Promise<{ expiresAt: string }> {
  const safeLogin = login.trim().toLowerCase();
  if (!safeLogin) throw new Error("Username wajib diisi");
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Jumlah menit gak valid");

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from(SUB_TABLE)
    .select("expires_at")
    .eq("login", safeLogin)
    .maybeSingle();

  const now = Date.now();
  const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiresAt = new Date(base + minutes * 60 * 1000).toISOString();

  const { error } = await supabase.from(SUB_TABLE).upsert({
    login: safeLogin,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Gagal kasih reward Plus: ${error.message}`);

  return { expiresAt: newExpiresAt };
}

export async function rejectPlusSubmission(params: {
  submissionId: string;
  reviewedBy: string;
  note?: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: submission } = await supabase
    .from(SUBMISSION_TABLE)
    .select("status")
    .eq("id", params.submissionId)
    .single();
  if (!submission) throw new Error("Submission gak ditemukan");
  if (submission.status !== "pending") throw new Error("Submission ini udah diproses sebelumnya");

  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .update({
      status: "rejected",
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      note: params.note || null,
    })
    .eq("id", params.submissionId)
    .select()
    .single();
  if (error) throw new Error(`Gagal update submission: ${error.message}`);
  return data;
}

// ---- Saweria (donasi -> Plus OTOMATIS, tanpa approve manual owner) --------
// Dipanggil dari webhook /api/plus/saweria-webhook (lihat lib/saweria.ts buat
// verifikasi signature-nya). Butuh kolom TAMBAHAN di plus_payment_submissions
// (lihat supabase_schema.txt bagian 5): `source` & `saweria_donation_id`.

// Idempotency: 1 donation id dari Saweria cuma boleh diproses SEKALI —
// Saweria bisa aja ngirim ulang webhook yang sama (retry jaringan dll), jadi
// WAJIB dicek dulu sebelum ngasih Plus, biar orang gak dapet Plus dobel dari
// 1 donasi yang sama.
export async function findSaweriaSubmissionByDonationId(donationId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(SUBMISSION_TABLE)
    .select("id")
    .eq("saweria_donation_id", donationId)
    .maybeSingle();
  return data;
}

// Nominal dari Saweria OTOMATIS dicek ulang di sini (BUKAN cuma dipercaya
// mentah-mentah dari payload webhook) sebelum Plus beneran diaktifkan:
//   1. Harus angka valid & lebih besar dari 0.
//   2. Dibulatkan ke integer rupiah (jaga-jaga ada desimal aneh).
//   3. computeDaysFromAmount() yang mutusin berapa hari — sama persis
//      aturannya kayak jalur QRIS manual (kelipatan Rp10.000 = 1 minggu,
//      sisa yang gak genap kelipatan HANGUS, di bawah minimum = 0 hari).
// Kalau ternyata di bawah minimum, FUNGSI INI GAK DIPANGGIL — caller (route
// webhook) yang mutusin buat catet sebagai "rejected otomatis" lewat
// recordAutoRejectedSaweriaDonation, bukan diem-diem diabaikan, biar user
// yang donasi ketauan alasannya kalau nanya ke owner.
export async function autoApproveSaweriaDonation(params: {
  donationId: string;
  login: string;
  avatarUrl: string | null;
  donatorName: string;
  amountIdr: number;
}) {
  const finalLogin = params.login.trim().toLowerCase();
  const safeAmount = Math.round(Number(params.amountIdr));
  if (!finalLogin) throw new Error("Username tujuan wajib diisi");
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new Error("Nominal donasi gak valid");
  }

  const finalDays = computeDaysFromAmount(safeAmount);
  if (finalDays <= 0) {
    throw new Error("Nominal di bawah minimum, harusnya gak lewat sini");
  }

  const supabase = getSupabaseAdmin();

  // Perpanjang dari expiry lama kalau masih aktif, atau mulai dari sekarang
  // — sama persis logikanya kayak approvePlusSubmission (QRIS manual).
  const { data: existing } = await supabase
    .from(SUB_TABLE)
    .select("expires_at")
    .eq("login", finalLogin)
    .maybeSingle();

  const now = Date.now();
  const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
  const base = currentExpiry > now ? currentExpiry : now;
  const newExpiresAt = new Date(base + finalDays * MS_PER_DAY).toISOString();

  const { error: upsertErr } = await supabase.from(SUB_TABLE).upsert({
    login: finalLogin,
    avatar_url: params.avatarUrl,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) throw new Error(`Gagal aktivasi Plus: ${upsertErr.message}`);

  const { data: inserted, error: insertErr } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      login: finalLogin,
      avatar_url: params.avatarUrl,
      proof_path: null, // gak ada upload bukti — otomatis via webhook Saweria
      sender_name: params.donatorName || "(donatur Saweria)",
      amount_idr: safeAmount,
      computed_days: finalDays,
      status: "approved",
      final_login: finalLogin,
      final_days: finalDays,
      reviewed_by: "system:saweria",
      reviewed_at: new Date().toISOString(),
      note: "Otomatis disetujui — donasi Saweria, username kecocokan dari pesan donasi.",
      source: "saweria",
      saweria_donation_id: params.donationId,
    })
    .select()
    .single();
  if (insertErr) throw new Error(`Gagal catat submission Saweria: ${insertErr.message}`);

  return { submission: inserted, expiresAt: newExpiresAt };
}

// Dipanggil kalau username GITHUB gak ketemu (atau ambigu) dari pesan
// donasi — Plus BELUM diaktifkan, submission masuk status 'pending' biasa
// biar owner cocokin manual di Owner Panel (form "Username tujuan" udah ada
// di sana), sama kayak review QRIS manual selama ini. `login` diisi tebakan
// awal (nama donatur yang di-slug) cuma buat starting point form, BUKAN
// keputusan final.
export async function recordUnmatchedSaweriaDonation(params: {
  donationId: string;
  donatorName: string;
  message: string;
  amountIdr: number;
}) {
  const safeAmount = Math.round(Number(params.amountIdr)) || 0;
  const computedDays = computeDaysFromAmount(safeAmount);
  const guessLogin =
    (params.donatorName || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 39) || "unknown";

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      login: guessLogin,
      avatar_url: null,
      proof_path: null,
      sender_name: params.donatorName || "(donatur Saweria)",
      amount_idr: safeAmount,
      computed_days: computedDays,
      status: "pending",
      note: `Otomatis dari Saweria, TAPI username KRYNOS gak ketemu/ambigu di pesan donasi: "${params.message || "(kosong)"}". Cocokin manual username tujuan di bawah sebelum approve.`,
      source: "saweria",
      saweria_donation_id: params.donationId,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal catat submission Saweria (unmatched): ${error.message}`);
  return data;
}

// Nominal di bawah minimum (Rp10.000) — dicatat status 'rejected' LANGSUNG
// (gak perlu nunggu owner), tapi tetep ada jejaknya di riwayat biar user
// yang komplain "kok Plus gue gak aktif" bisa dicek alasannya jelas: bukan
// bug, tapi nominalnya emang kurang.
export async function recordAutoRejectedSaweriaDonation(params: {
  donationId: string;
  donatorName: string;
  amountIdr: number;
  login: string | null;
}) {
  const safeAmount = Math.round(Number(params.amountIdr)) || 0;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUBMISSION_TABLE)
    .insert({
      login: params.login || "unknown",
      avatar_url: null,
      proof_path: null,
      sender_name: params.donatorName || "(donatur Saweria)",
      amount_idr: safeAmount,
      computed_days: 0,
      status: "rejected",
      reviewed_by: "system:saweria",
      reviewed_at: new Date().toISOString(),
      note: `Otomatis ditolak — nominal Rp${safeAmount.toLocaleString("id-ID")} di bawah minimum Rp${PLUS_PRICE_PER_WEEK_IDR.toLocaleString("id-ID")}, gak dihitung.`,
      source: "saweria",
      saweria_donation_id: params.donationId,
    })
    .select()
    .single();
  if (error) throw new Error(`Gagal catat submission Saweria (rejected): ${error.message}`);
  return data;
}
