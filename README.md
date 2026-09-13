# KRYNOS

Web editor GitHub lengkap: login GitHub, edit/buat/hapus file, buat & hapus branch,
buat repository baru, pengaturan repository, issues + komentar, releases, upload
file **atau folder** sekaligus (fitur yang GitHub web bawaan tidak punya), dan
saran kode AI (gratis, pakai Groq) mirip Copilot — tekan `Tab` untuk terima saran.
Tampilan sudah responsive: enak dipakai di HP maupun desktop.

## 1. Buat GitHub OAuth App

1. Buka https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `https://www.mastercode.my.id` (isi `http://localhost:3000` dulu kalau masih lokal)
3. Authorization callback URL:
   - Lokal: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://www.mastercode.my.id/api/auth/callback/github`
4. Simpan `Client ID` dan `Client Secret`

## 2. Buat API Key Groq (GRATIS, buat fitur AI suggestion)

1. Daftar di https://console.groq.com
2. Buat API key baru
3. Simpan key-nya

## 2b. (Opsional) Token Vercel — buat fitur Live Preview

1. Buka https://vercel.com/account/tokens → **Create Token**
2. Simpan token-nya sebagai `VERCEL_TOKEN`
3. Kalau project kamu di bawah Team (bukan Personal Account), isi juga `VERCEL_TEAM_ID`
   (lihat di Team Settings → General → Team ID)
4. Fitur ini nyari otomatis project Vercel mana yang terhubung ke repo yang lagi
   kamu buka — jadi repo itu emang harus sudah di-import ke Vercel dulu (lewat
   `vercel.com/new` atau `vercel` CLI) biar ada datanya
5. Kalau project Vercel-nya pakai Deployment Protection (Vercel Authentication),
   preview-nya bakal kena halaman "request access" tiap dibuka. Biar langsung
   tembus tanpa itu: Project Settings → Deployment Protection → **Protection
   Bypass for Automation** → generate secret → isi sebagai `VERCEL_AUTOMATION_BYPASS_SECRET`

## 2b-2. (Opsional) Token Netlify — sama kayak Vercel, provider alternatif

1. Buka https://app.netlify.com/user/applications → **Personal access tokens** → **New access token**
2. Simpan token-nya sebagai `NETLIFY_TOKEN`
3. Sama kayak Vercel, fitur ini nyari otomatis site Netlify mana yang terhubung
   ke repo yang lagi kamu buka — repo-nya harus udah di-link ke site Netlify dulu
   (lewat Netlify UI: **Add new site → Import an existing project**)
4. Boleh setup Vercel aja, Netlify aja, atau dua-duanya sekaligus — KRYNOS
   otomatis nampilin Live Preview & status deploy cuma buat provider yang
   beneran terhubung ke repo itu

## 2c. (Opsional) Supabase — buat fitur Survey/Live

1. Bikin project gratis di https://supabase.com
2. Buka **SQL Editor**, jalanin ini buat bikin tabelnya:

   ```sql
   create table survey_responses (
     id uuid primary key default gen_random_uuid(),
     login text not null,
     avatar_url text,
     week_key text not null,
     rating integer not null check (rating between 1 and 5),
     reason text not null,
     created_at timestamptz not null default now(),
     unique (login, week_key)
   );
   create index survey_responses_week_idx on survey_responses (week_key, created_at desc);
   ```

   **Kalau kamu update dari versi survey yang LAMA** (masih ada pertanyaan
   opini/keluhan/saran terpisah), jalanin migrasi ini di SQL Editor (aman,
   gak nge-hapus data survey yang udah ada — kolom `opinion` di-rename jadi
   `reason`, kolom yang udah gak dipakai dibiarin ada tapi gak wajib diisi
   lagi):
   ```sql
   alter table survey_responses rename column opinion to reason;
   alter table survey_responses alter column has_issue drop not null;
   alter table survey_responses alter column suggestion drop not null;
   ```
   (Kalau tabelnya malah belum punya kolom `rating` sama sekali karena masih
   versi paling lama, jalanin dulu migrasi rating-nya sebelum yang di atas —
   lihat komentar lengkap di `supabase_schema.txt`.)

3. Buka **Settings → API**, copy **Project URL** → `SUPABASE_URL`
4. Di halaman yang sama, copy **service_role key** (bukan `anon` key!) →
   `SUPABASE_SERVICE_ROLE_KEY`. Key ini cuma dipakai di server (route API),
   jangan pernah ditaruh di kode yang jalan di browser.

## 2d. (Opsional) Owner Panel — statistik user

Butuh Supabase yang sama seperti di atas, plus 1 tabel tambahan. Di **SQL
Editor** Supabase, jalanin:

```sql
create table user_activity (
  login text primary key,
  avatar_url text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_active_seconds bigint not null default 0
);
```

Owner Panel (`/owner`) cuma bisa dibuka akun GitHub `@KRYNOSTeams`
(hardcoded di `lib/owner.ts`) dan nampilin: jumlah user terdaftar, jumlah
user aktif (24 jam terakhir), rata-rata user aktif bulanan (30 hari
terakhir), rata-rata waktu pakai per user, dan rata-rata pengirim survey
per minggu.

## 2e. (Opsional) Live Preview — token Protection Bypass per-repo

Kalau mau simpan token "Protection Bypass for Automation" (Vercel) per
repository lewat menu **Settings → Live Preview**, butuh Supabase (sama
seperti di atas) plus 1 tabel tambahan. Di **SQL Editor** Supabase, jalanin:

```sql
create table vercel_protection_tokens (
  owner text not null,
  repo text not null,
  bypass_secret text not null,
  updated_at timestamptz not null default now(),
  primary key (owner, repo)
);
```

Tanpa tabel ini, nyimpen token di Settings bakal gagal dengan error
`Could not find the table 'public.vercel_protection_tokens'`.

## 2f. (Opsional) Komunitas & Announcement

Butuh Supabase (sama seperti di atas). Di **SQL Editor** Supabase, jalanin:

```sql
create table community_messages (
  id uuid primary key default gen_random_uuid(),
  login text not null,
  avatar_url text,
  type text not null default 'text',
  content text,
  poll_id uuid,
  created_at timestamptz not null default now()
);
create index community_messages_created_idx on community_messages (created_at);
create index community_messages_login_idx on community_messages (login);

create table community_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  created_by text not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table community_poll_votes (
  poll_id uuid not null,
  login text not null,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, login)
);

create table community_meta (
  key text primary key,
  value text
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
create index announcements_created_idx on announcements (created_at desc);

create table announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  login text not null,
  avatar_url text,
  content text not null,
  created_at timestamptz not null default now()
);
create index announcement_comments_ann_idx on announcement_comments (announcement_id, created_at);

create table announcement_meta (
  key text primary key,
  value text
);
```

Terus bikin **1 storage bucket** (ini lewat Dashboard, bukan SQL): buka
**Storage** di sidebar Supabase → **New bucket** → nama `community-uploads`
→ aktifkan **Public bucket**. Ini tempat nyimpen gambar yang dikirim di
`/komunitas`.

**Cara kerja fitur ini:**
- `/komunitas`: chat global. Semua user maks. **50 pesan per 30 menit**
  (dihitung otomatis, gak perlu setting apa-apa). **Semua pesan & polling
  ke-reset (kehapus) otomatis tiap 30 menit** buat semua orang — reset-nya
  dicek pas ada yang buka/kirim chat (bukan pakai cron server terpisah)
- Cuma akun `@KRYNOSTeams` (lihat `lib/owner.ts`) yang bisa bikin
  **Global Polling** — pesan khusus yang tersemat di chat dengan timer
  yang bisa diatur, semua user bisa vote
- `/announcement`: cuma owner yang bisa bikin pengumuman baru (pengumuman-
  nya PERMANEN, gak pernah ke-reset). Semua user bisa komentar di tiap
  pengumuman — **komentarnya ke-reset (kehapus) otomatis tiap 45 menit**,
  pakai mekanisme yang sama kayak reset chat komunitas

## 2g. (Wajib buat fitur Collaboration) Tabel token & undangan

```sql
create table user_github_tokens (
  login text primary key,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  owner_login text not null,
  repo text not null,
  invited_login text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (owner_login, repo, invited_login)
);
create index collab_invited_idx on collaboration_invites (invited_login, status);
create index collab_owner_idx on collaboration_invites (owner_login, repo);

create table db_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  connection_string text not null,
  created_at timestamptz not null default now()
);
```

## 2h. (Opsional) Database Tambahan + SQL Editor (khusus Owner)

Owner Panel punya section buat nambah koneksi Postgres/Supabase LAIN
(misal kalau database utama mepet limit storage-nya), plus SQL Editor
buat jalanin query APAPUN langsung dari situ, gak perlu buka dashboard
Supabase.

**Cara pakai:** Owner Panel → Database Tambahan → Tambah → isi nama +
connection string (ambil dari Supabase lain: Project Settings → Database
→ Connection string → pilih mode **Transaction**, port **6543** — BUKAN
mode Direct/port 5432, biar cocok buat serverless function Vercel).

⚠️ **Ini alat manual buat owner** — nambah koneksi di sini TIDAK otomatis
mindahin data fitur KRYNOS (Komunitas, Plus, dll) ke situ. Fitur-
fitur itu tetap pakai `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` utama.


⚠️ **Catatan keamanan**: `user_github_tokens` nyimpen access token GitHub
ASLI di database (bukan cuma di session browser kayak biasanya) — ini
dibutuhin biar collaborator yang di-invite bisa "pinjam" akses ke repo
yang bukan miliknya. Jaga Supabase service role key kamu baik-baik.

## 3. Setup environment variable

Copy `.env.example` jadi `.env.local`, lalu isi:

```
GITHUB_ID=...
GITHUB_SECRET=...
NEXTAUTH_SECRET=... (generate: openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
GROQ_API_KEY=...
ALLOWED_GITHUB_USERS=username_github_kamu
NEXT_PUBLIC_ADMIN_WHATSAPP=62812xxxxxxx
```

> **`ALLOWED_GITHUB_USERS`** ini pengaman: hanya username GitHub yang kamu daftarkan
> di sini yang bisa login ke aplikasi ini. Kalau ada orang lain buka link app kamu
> dan coba login pakai akun mereka sendiri, otomatis ditolak. Bisa isi beberapa
> username dipisah koma, contoh `budi,siti`. Kosongkan variable ini kalau memang
> mau semua orang boleh login (masing-masing tetap hanya bisa akses repo mereka
> sendiri, bukan repo kamu).

> **`NEXT_PUBLIC_ADMIN_WHATSAPP`** dipakai di halaman `/banned` — kalau owner
> nge-ban seorang user dari Owner Panel, user itu bakal lihat 3 opsi: cek alasan
> ban, hubungi nomor WhatsApp ini buat mengajukan banding, atau logout. Format
> nomor: kode negara tanpa "+"/"0" di depan (misal `6281234567890`). Kosongkan
> kalau belum ada nomor kontak — tombol WhatsApp-nya otomatis disembunyikan.


## 4. Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## 4b. (Opsional) Notifikasi Push Beneran (Web Push)

Beda sama fitur "Aktifkan Notifikasi" versi awal (yang cuma jalan selama tab
kebuka), ini pakai **Web Push API + VAPID** — notifikasi beneran nyampe ke
HP walau app-nya lagi ditutup total, sama kayak notifikasi WhatsApp dkk
(mekanismenya emang sama, keduanya lewat push service Android/Chrome).

**1. Bikin tabel Supabase:**
```sql
create table push_subscriptions (
  login text not null,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  scope text not null default 'all',
  created_at timestamptz not null default now()
);
create index push_subscriptions_login_idx on push_subscriptions (login);
```

**2. Set environment variable ini** (VAPID key udah di-generate, tinggal pakai):
```
VAPID_PUBLIC_KEY=BP69QxWfP8Hcg4DA-WAgs-3RXxPUduJKAl2jSy2soQ3w5A-f5YKRK74ca4vQkKLlSVZZsttiTarReH_ZlUE68dE
VAPID_PRIVATE_KEY=d6zd7k-tOadzl11Xn4rwhWU3I5VkS3WSeU1JRHJ8I5s
VAPID_SUBJECT=mailto:emailkamu@contoh.com
```
`VAPID_PRIVATE_KEY` itu **secret**, perlakukan sama kayak token lain — jangan
di-commit, cukup di environment variable Vercel.

**Cara kerja:** owner otomatis dapat SEMUA jenis notifikasi (pengajuan Plus
baru, dll), user biasa cuma dapat notifikasi pas ada **Announcement baru**
— sesuai yang diminta pas fitur ini dibikin.

## 4c. (Opsional) Build APK Android via GitHub Actions

Beda dari cara manual PWABuilder sebelumnya — ini otomatis build & sign APK/AAB
lewat GitHub Actions kapan pun kamu jalanin, pakai **Bubblewrap** (tool resmi
Google yang dipakai PWABuilder di baliknya juga).

**PENTING:** ini pakai **keystore/signing key BARU** (beda dari yang dulu dari
PWABuilder), jadi `assetlinks.json` di project juga udah diganti fingerprint-nya.
Kalau kamu belum pernah publish ke Play Store, aman lanjut. Kalau UDAH publish
pakai APK dari PWABuilder sebelumnya, **JANGAN** pakai APK dari sini buat update
listing yang sama (Play Store nolak app yang signing key-nya beda) — harus tetap
pakai keystore lama buat repo yang sama, atau publish sebagai listing baru.

**1. Tambah 3 GitHub Secrets** (repo Settings → Secrets and variables → Actions
→ New repository secret):

| Nama Secret | Isi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Isi file `mastercode-release.keystore.base64.txt` (dikirim terpisah) |
| `ANDROID_KEYSTORE_PASSWORD` | Dikirim terpisah lewat chat (jangan disimpan di sini) |
| `ANDROID_KEY_PASSWORD` | Dikirim terpisah lewat chat |

**2. Jalanin workflow-nya:** tab **Actions** di GitHub → pilih **"Build Android
App"** → **Run workflow** → isi versi (misal `1.0.1`) → Run.

**3. Ambil hasilnya:** setelah selesai (~3-5 menit), buka run yang barusan →
bagian **Artifacts** di bawah → download `master-code-android-{nomor}.zip`,
isinya `app-release-signed.apk` (buat testing manual) dan `app-release-bundle.aab`
(buat upload ke Play Store).

**Simpan file keystore (`mastercode-release.keystore`) baik-baik** di luar Git —
itu kunci penandatanganan permanen, kalau hilang kamu gak akan bisa update app
yang sama lagi di Play Store.

## 5. Deploy ke Vercel

1. Push project ini ke repository GitHub kamu
2. Import repo di https://vercel.com/new
3. Di **Environment Variables**, isi semua variabel yang sama seperti `.env.local`,
   tapi `NEXTAUTH_URL` diisi domain kamu, contoh `https://www.mastercode.my.id`
4. Deploy
5. Balik lagi ke GitHub OAuth App settings, update Authorization callback URL
   ke domain Vercel yang sudah jadi

## Fitur

- Login via GitHub OAuth (scope penuh: repo, delete_repo, workflow, user:follow)
- Dashboard: cari & lihat semua repo, buat repo baru (private/public, gitignore template)
- File explorer lengkap (tree recursive, folder bisa dibuka/tutup)
- Buat, edit, simpan (commit), hapus file
- Buat folder (via placeholder `.gitkeep`, sesuai cara kerja Git)
- **Upload file maupun folder sekaligus** dalam satu commit (pakai Git Trees API)
- Buat & hapus branch, pindah branch
- Commit dengan pesan custom
- Issues: buat issue, lihat & kirim komentar
- Releases: buat release/tag, tandai pre-release, lihat daftar release
- Pengaturan repository: deskripsi, default branch, visibility (public/private),
  aktifkan/nonaktifkan issues & wiki, hapus repository (danger zone)
- **Logs**: riwayat semua perubahan (commit history) per repo, klik buat lihat file
  apa saja yang berubah beserta diff-nya (baris ditambah/dihapus)
- **Explore Public Repo**: cari & lihat repository publik siapapun di GitHub,
  mode read-only otomatis kalau bukan repo milik sendiri, dengan tombol:
  - **Download ZIP** — download langsung repo publik apa saja
  - **Copy** — salin isi repo publik jadi repo *milik sendiri sepenuhnya*
    (bukan GitHub fork), bisa langsung diatur **private**, dan bisa pilih:
    bikin repo baru ATAU timpa ke salah satu repo kamu yang sudah ada
- **Test**: 2 bagian dalam satu tombol —
  - **Live Preview**: nunjukin website beneran jalan (deployment Vercel yang cocok
    dengan repo & branch aktif), status build real-time, tombol **Stop** buat
    batalin deployment yang lagi building, bisa dilihat langsung lewat iframe
    di dalam app atau buka tab baru (butuh `VERCEL_TOKEN`, opsional)
  - **Build & Test (CI)**: trigger GitHub Actions, pantau status (antri/jalan/
    sukses/gagal), riwayat run, dan generate workflow CI dasar otomatis kalau
    repo belum punya sama sekali
- **Search** (`/search`): cari repository ATAU user GitHub, ada filter tab,
  hasil klik langsung ke halaman overview
- **Profil User** (`/users/[username]`): lihat profil siapa aja, bio, lokasi,
  daftar repo mereka, tombol **Follow/Unfollow**, lihat daftar **Followers**
  & **Following**. Kalau itu profil kamu sendiri, ada tombol Edit Profil
- **Auto-Follow**: setiap login (akun baru daftar ATAU akun lama login ulang)
  otomatis follow akun GitHub kamu (si pemilik/pencipta KRYNOS) di
  belakang layar, gak ada tombol/konfirmasi yang keliatan ke user — kalau
  gagal (misal scope token belum update) dibiarin diam-diam, gak ganggu
  proses login. User lama yang udah pernah daftar sebelum fitur ini ada bisa
  di-backfill sekali dari Owner Panel (tombol "Auto-Follow Backfill")
- **Repository Overview** (`/repository/[owner]/[repo]`): halaman ala GitHub
  — README ke-render rapi, statistik (star, fork, watcher), tombol
  **Favorite/Star**, tombol buka langsung ke editor
- **Settings** (`/settings`): edit profil GitHub kamu sendiri (nama, bio,
  perusahaan, lokasi, website, Twitter/X) langsung dari app
- **Auto-refresh (live)**: angka followers/following/repos/star, ke-refresh
  tiap 8 detik (daftar followers/following tiap 15 detik) selama halaman
  dibuka & tab aktif — berhenti otomatis kalau tab di-minimize, biar hemat
  jatah API GitHub. Update-nya TIDAK PERNAH reload halaman atau nunjukin
  loading spinner; angka yang berubah cuma berkedip halus (hijau = nambah,
  merah = berkurang) sekilas lalu balik normal, jadi gak mengganggu
- AI code suggestion gratis (Groq) — ghost text inline di editor, tekan Tab untuk terima
- Responsive penuh: sidebar jadi drawer di HP, tetap fixed di desktop
- Whitelist login (`ALLOWED_GITHUB_USERS`) + middleware server-side, biar cuma kamu
  yang bisa akses dashboard/editor meski URL app-nya diketahui orang lain

## Catatan

- **Kalau kamu update dari versi sebelumnya**: scope OAuth login utama nambah
  `user:follow` (buat fitur Follow). Token lama yang udah kamu punya TIDAK
  otomatis dapet scope baru ini — **logout dulu, terus login ulang** biar
  GitHub minta izin ulang dengan scope yang baru. Kalau enggak, tombol
  Follow/Unfollow bakal gagal dengan error izin.
- Semua request ke GitHub API dilakukan lewat API route Next.js di server
  menggunakan access token dari sesi NextAuth, jadi token tidak pernah
  ter-expose ke client.
- Model AI default: `llama-3.1-8b-instant` (Groq), cepat & masih di dalam
  kuota gratis untuk pemakaian wajar. Bisa diganti di `lib/groq.ts`.
