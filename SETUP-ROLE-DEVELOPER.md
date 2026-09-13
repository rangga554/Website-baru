# Role Developer

Ditambahkan role `Developer` terpisah dari Owner dan Admin.

## 1. Jalankan SQL

Di Supabase SQL Editor, jalankan:

```sql
create table if not exists app_developers (
  login text primary key,
  added_by text not null,
  created_at timestamptz not null default now()
);
```

## 2. Memberikan role Developer

Login sebagai Owner, buka **Owner Panel → Kelola Developer**, lalu masukkan username GitHub.

Developer akan mendapatkan badge `[DEV🧑‍💻]` dan akses privileged seperti Admin.

## 3. Mencabut role

Owner dapat menekan tombol hapus pada daftar Developer.


## Akses Dev Panel
Owner cukup memasukkan **username GitHub** di bagian Kelola Developer pada Owner Panel.
Setelah ditambahkan ke tabel `app_developers`, user tersebut akan melihat menu **Dev Panel** dan dapat membuka `/dev`.
Untuk mencabut akses, Owner tinggal menekan tombol hapus pada username tersebut.
