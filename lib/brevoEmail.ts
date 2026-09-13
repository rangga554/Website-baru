// ============================================================================
// Pengirim email pakai Brevo (dulu Sendinblue) — dipilih karena free tier-nya
// paling generous & GRATIS SELAMANYA (gak perlu kartu kredit): 300 email per
// hari, cukup jauh buat kebutuhan kirim kode verifikasi/OTP (bukan mass
// email). Daftar & ambil API key di: https://app.brevo.com/settings/keys/api
//
// ENV VAR yang dibutuhkan:
//   BREVO_API_KEY=xkeysib-xxxxx
//   BREVO_SENDER_EMAIL=noreply@domainkamu.com  (harus di-verify dulu di
//     Brevo -> Senders, atau pakai domain yang udah di-authenticate)
//   BREVO_SENDER_NAME=KRYNOS   (opsional, default "KRYNOS")
// ============================================================================

export function isBrevoConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  verifyUrl: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "KRYNOS";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "BREVO_API_KEY / BREVO_SENDER_EMAIL belum di-set di environment variable"
    );
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: params.to }],
      subject: `${params.code} — Kode verifikasi KRYNOS`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Verifikasi email KRYNOS</h2>
          <p>Masukin kode ini di halaman verifikasi:</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:6px">${params.code}</p>
          <p>Atau klik tombol ini (berlaku 30 menit):</p>
          <p><a href="${params.verifyUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Verifikasi Email</a></p>
          <p style="color:#888;font-size:12px">Kalau kamu gak minta ini, abaikan aja email ini.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gagal kirim email verifikasi (Brevo): ${res.status} ${text}`);
  }
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "KRYNOS";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "BREVO_API_KEY / BREVO_SENDER_EMAIL belum di-set di environment variable"
    );
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: params.to }],
      subject: "Reset password KRYNOS",
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Reset password KRYNOS</h2>
          <p>Ada yang minta reset password buat akun KRYNOS yang pakai email ini. Kalau itu kamu, klik tombol di bawah (berlaku 30 menit):</p>
          <p><a href="${params.resetUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Reset Password</a></p>
          <p style="color:#888;font-size:12px">Kalau kamu gak minta ini, abaikan aja email ini — password kamu tetap aman, gak ada yang berubah.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gagal kirim email reset password (Brevo): ${res.status} ${text}`);
  }
}
