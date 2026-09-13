# Fitur Template — cara pasang

## 1. Jalanin migration
File `supabase_schema.txt` di zip ini udah GABUNGAN — seluruh schema project
kamu (22 tabel lama) + tabel `templates` baru (section 23) di paling bawah.
Cukup jalanin bagian section 23 aja di SQL editor Supabase kalau tabel lain
udah ada; kalau mau setup dari nol, jalanin seluruh file ini.

## 2. Copy file ke project
Salin folder `lib/` dan `app/` di zip ini ke project KRYNOS (timpa/gabung, jangan replace seluruh folder `app/api`).

File baru (backend):
- `lib/templates.ts` — logic parse URL, star silent, copy repo (tanpa fork)
- `app/api/owner/templates/route.ts` — GET list (owner) & POST tambah template
- `app/api/owner/templates/[id]/route.ts` — DELETE hapus template
- `app/api/templates/route.ts` — GET list publik (cuma id+title, buat sidebar)
- `app/api/templates/[id]/get/route.ts` — POST tombol "Get" (star + copy)

File baru (frontend):
- `app/template/page.tsx` — halaman user: list card Template + tombol Get →
  modal input nama repo baru → hasil link repo buat dibuka
- `components/TemplateManagementPanel.tsx` — panel owner: form tambah
  (judul + link repo) + list + tombol hapus, dirender di `/owner`

File yang DIEDIT (bukan file baru — GABUNGIN manual, jangan langsung timpa,
soalnya project asli kamu mungkin udah berubah dari versi yang aku baca):
- `components/Sidebar.tsx` — nambah 1 baris import icon `FaLayerGroup` +
  1 baris entry link `{ href: "/template", ... }` di `getLinks()`
- `app/owner/page.tsx` — nambah 1 baris import + 1 baris
  `{role.isOwner && <TemplateManagementPanel />}`

## Alur tombol Get
1. User klik "Get" di card template → modal minta nama repo baru
2. POST `/api/templates/{id}/get` body `{ newRepoName }`
3. Kalau `409` → tampilin pesan "nama udah kepake, ganti nama lain"
4. Kalau `200` → tampilin tombol "Buka Repo" ke `url` yang dibalikin

## Catatan penting
- Star ke repo sumber selalu jalan duluan sebelum copy, dan GAGAL-DIAM
  (gak nge-block proses kalau starnya error).
- Copy PASTI pakai cara manual (tree+blob), BUKAN Fork API — supaya gak ada
  label "Forked from" yang nempel permanen di GitHub.
- Repo gede banget bisa kena `truncated` dari GitHub Tree API dan gagal
  di-copy — sesuai keputusan, ini gak divalidasi otomatis (owner yang jaga).
