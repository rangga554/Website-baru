# Setup Fitur Baru KRYNOS

Checklist ini CUMA buat fitur yang BARU ditambahin. GitHub OAuth, Groq,
dan Supabase dasar dianggap udah beres.

---

## ☐ 1. Jalanin `supabase_schema.txt` di Supabase → SQL Editor

Semua tabel SQL project ini ada di **1 file: `supabase_schema.txt`** (di
root project). Tinggal buka file itu, copy semua isinya, paste & run di
Supabase SQL Editor. Aman dijalanin berkali-kali walau sebagian tabel udah
ada sebelumnya.

**Cek:** buka Supabase → Table Editor, pastiin semua tabel di
`supabase_schema.txt` muncul (`user_github_tokens`, `collaboration_invites`,
`db_connections`, `push_subscriptions`, `web_store_sites`).

---

## ☐ 2. Push Notification (VAPID) — kalau belum di-setup sebelumnya

Key udah pernah di-generate, tinggal isi ke environment variable:
```
VAPID_PUBLIC_KEY=BP69QxWfP8Hcg4DA-WAgs-3RXxPUduJKAl2jSy2soQ3w5A-f5YKRK74ca4vQkKLlSVZZsttiTarReH_ZlUE68dE
VAPID_PRIVATE_KEY=d6zd7k-tOadzl11Xn4rwhWU3I5VkS3WSeU1JRHJ8I5s
VAPID_SUBJECT=mailto:emailkamu@contoh.com
```
Tabel `push_subscriptions` udah termasuk di `supabase_schema.txt` (poin 1).

**Cek:** login, tunggu popup "Aktifkan Notifikasi" muncul, tekan Aktifkan.

---

## ☐ 3. npm install (dependency baru)

Paket baru yang perlu ke-install: `pg`, `cheerio`,
`html-to-image`, `jszip`, `web-push`. Semua udah ada di `package.json`,
tinggal:
```bash
npm install
```

---

## ☐ 4. (Opsional) Site Inspector

Gak butuh setup tambahan apa-apa — langsung jalan begitu deploy. Cuma
pastiin **outbound network** dari server gak diblokir (buat DNS/WHOIS/SSL
check ke domain luar).

---

## ☐ 5. Web Store (daftar website + AI cek keamanan data pengguna)

Tabel SQL-nya udah ada di `supabase_schema.txt` (poin 1). Selain itu:

```
CRON_SECRET=<string acak minimal 16 karakter, generate sendiri>
```

`vercel.json` udah nyertain konfigurasi cron (`/api/web-store/cron-check`,
jalan 1x/hari jam 20:00 UTC / kira-kira jam 3 pagi WIB). **Vercel otomatis
ngirim `CRON_SECRET` sebagai header Authorization tiap manggil endpoint
itu** — kamu cuma perlu isi env var-nya di Vercel, gak perlu setting apa-apa
lagi soal cron-nya. Cron bawaan Vercel di paket Hobby (gratis) maksimal
1x/hari, jadi jadwal ini udah pas.

**Cek:** daftarin 1 website test di menu "Web Store" (sidebar), pastiin
hasil pengecekan (skor + status) langsung muncul dalam beberapa detik.

---

## ☐ 6. Lupa Password + Notifikasi Keamanan

Tabel SQL-nya udah ada di `supabase_schema.txt` (poin 1, section 19).
Gak ada env var baru — reuse `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` yang
udah di-setup buat verifikasi email.

**Cek:**
- Login pakai akun Username/Email → klik "Lupa password?" di halaman login
  → masukin email → cek inbox, link reset harus nyampe dalam beberapa detik
  → klik link → bikin password baru → coba login pakai password baru itu
- Login (akun apa aja) dari browser yang belum pernah dipakai buat akun itu
  → cek lonceng notifikasi, harus muncul "Perangkat baru login"
- Akun Username/Email → Settings → "Ganti Password" → cek lonceng
  notifikasi, harus muncul "Password diganti"
- Pastiin proses "Lupa Password" TIDAK memunculkan notifikasi apapun di
  lonceng (ini disengaja)

---

## Testing checklist abis semua di atas beres

- [ ] Undang collaborator (RepoSettings → Collaboration) → user lain terima undangan → bisa edit file repo itu
- [ ] Owner Panel → Database Tambahan → tambah koneksi → SQL Editor jalan
- [ ] Dashboard: tab filter Semua/GitHub/Collaboration kefungsi
- [ ] Web Store: daftarin website → hasil AI muncul → tunggu cron jalan (atau trigger manual `vercel crons trigger /api/web-store/cron-check` via Vercel CLI) → `last_checked_at` ke-update
- [ ] Lupa password: minta reset → email nyampe → link jalan → password baru bisa dipakai login
- [ ] Notifikasi keamanan: login device baru & ganti password manual masing-masing muncul di lonceng; reset lewat lupa password TIDAK muncul
