import { NextRequest } from "next/server";
import {
  isSaweriaConfigured,
  verifySaweriaSignature,
  getSaweriaSignatureFromHeaders,
  matchLoginFromMessage,
} from "@/lib/saweria";
import {
  findSaweriaSubmissionByDonationId,
  autoApproveSaweriaDonation,
  recordUnmatchedSaweriaDonation,
  recordAutoRejectedSaweriaDonation,
  computeDaysFromAmount,
} from "@/lib/plus";
import { sendPushToUser } from "@/lib/push";
import { logAction } from "@/lib/auditLog";

// ============================================================================
// Endpoint PUBLIK (sengaja gak pakai getServerSession — yang manggil ini
// server Saweria, bukan browser user yang login). Keamanan dijaga LEWAT
// verifikasi signature HMAC (lib/saweria.ts), BUKAN lewat session cookie.
//
// Setup URL ini di: saweria.co/admin/integrations -> Webhook -> isi dengan
// https://domain-kamu.com/api/plus/saweria-webhook
// ============================================================================

export async function POST(req: NextRequest) {
  // Fail CLOSED kalau env SAWERIA_STREAM_KEY belum di-setup — jangan pernah
  // auto-approve apapun tanpa signature yang bisa diverifikasi.
  if (!isSaweriaConfigured()) {
    return Response.json({ error: "Integrasi Saweria belum dikonfigurasi di server ini" }, { status: 501 });
  }

  // WAJIB baca raw text body (bukan req.json() langsung) — signature HMAC
  // dihitung dari byte mentahnya, kalau di-parse dulu terus di-stringify
  // ulang bisa beda hasil (urutan key, spasi, dll) dan verifikasi gagal.
  const rawBody = await req.text();
  const signature = getSaweriaSignatureFromHeaders(req.headers);

  if (!verifySaweriaSignature(rawBody, signature)) {
    return Response.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  // Cuma proses event donasi — abaikan jenis event lain kalau ada.
  if (payload.type && payload.type !== "donation") {
    return Response.json({ ok: true, skipped: "bukan event donasi" });
  }

  const donationId = String(payload.id || "");
  if (!donationId) {
    return Response.json({ error: "Payload gak punya id donasi" }, { status: 400 });
  }

  // ---- Idempotency: donasi yang SAMA gak boleh diproses 2x (Saweria bisa
  // retry webhook kalau gak dapet respons 200 tepat waktu) ----
  try {
    const already = await findSaweriaSubmissionByDonationId(donationId);
    if (already) {
      return Response.json({ ok: true, skipped: "sudah pernah diproses" });
    }
  } catch {
    // kalau kolom saweria_donation_id belum ke-migrasi di Supabase, jangan
    // sampai seluruh webhook error total — biarin lanjut, worst-case cuma
    // kehilangan proteksi idempotency, bukan crash.
  }

  const donatorName = String(payload.donator_name || "").slice(0, 200);
  const message = String(payload.message || "").slice(0, 500);

  // ---- Validasi nominal — SISTEM YANG NENTUIN, bukan percaya mentah dari
  // payload. amount_raw dari Saweria itu NOMINAL PENUH yang didonasikan
  // (belum dipotong `cut`/biaya platform), jadi ini yang dipakai buat
  // hitung hari Plus, BUKAN payload.cut atau field lain. ----
  const amountRaw = Number(payload.amount_raw);
  const amountIdr = Number.isFinite(amountRaw) ? Math.round(amountRaw) : 0;

  if (amountIdr <= 0) {
    return Response.json({ ok: true, skipped: "nominal gak valid, diabaikan" });
  }

  const computedDays = computeDaysFromAmount(amountIdr);

  try {
    // Nominal di bawah minimum -> tolak otomatis + catat jejaknya, JANGAN
    // sentuh plus_subscriptions sama sekali.
    if (computedDays <= 0) {
      const matchedLoginForLog = await matchLoginFromMessage(message).catch(() => null);
      await recordAutoRejectedSaweriaDonation({
        donationId,
        donatorName,
        amountIdr,
        login: matchedLoginForLog,
      });
      return Response.json({ ok: true, result: "rejected_below_minimum" });
    }

    const matchedLogin = await matchLoginFromMessage(message);

    if (!matchedLogin) {
      await recordUnmatchedSaweriaDonation({ donationId, donatorName, message, amountIdr });
      return Response.json({ ok: true, result: "pending_unmatched" });
    }

    const result = await autoApproveSaweriaDonation({
      donationId,
      login: matchedLogin,
      avatarUrl: null,
      donatorName,
      amountIdr,
    });

    logAction(
      "system:saweria",
      "auto_approve_plus_saweria",
      `Donasi Saweria Rp${amountIdr.toLocaleString("id-ID")} dari "${donatorName}" -> Plus ${result.submission.final_days} hari buat ${matchedLogin}`
    );

    sendPushToUser(matchedLogin, {
      title: "KRYNOS Plus Aktif Otomatis! 🎉",
      body: `Donasi Saweria kamu Rp${amountIdr.toLocaleString("id-ID")} terverifikasi, Plus aktif ${result.submission.final_days} hari.`,
      url: "/plus",
    }).catch(() => {});

    return Response.json({ ok: true, result: "approved", login: matchedLogin, expiresAt: result.expiresAt });
  } catch (e: any) {
    // Tetep balikin 200 biar Saweria gak retry-bomb webhook ini kalau
    // errornya emang bakal gagal lagi terus (misal tabel belum dimigrasi) —
    // tapi errornya dicatet ke activity log biar owner ketauan ada yang
    // butuh perhatian.
    logAction("system:saweria", "saweria_webhook_error", `${e.message} (donationId: ${donationId})`);
    return Response.json({ ok: false, error: e.message }, { status: 200 });
  }
}
