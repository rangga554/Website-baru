"use client";

import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { FaShieldAlt, FaArrowLeft } from "react-icons/fa";

// Terakhir diupdate manual — WAJIB diganti tiap kali isi kebijakan di bawah
// beneran diubah (bukan auto-generate dari commit), biar akurat.
const LAST_UPDATED = "17 Agustus 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      <div className="text-xs text-gray-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-base pb-12">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaShieldAlt className="text-accent" /> Kebijakan Privasi
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <AppLogo size="w-14 h-14" rounded="rounded-2xl" badgeSize="w-5 h-5 text-sm" className="mx-auto" />
          <h2 className="text-lg font-bold">
            Master <span className="text-accent">Code</span> — Kebijakan Privasi
          </h2>
          <p className="text-[11px] text-gray-500">Terakhir diperbarui: {LAST_UPDATED}</p>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Dokumen ini nerangin data apa aja yang KRYNOS kumpulin dari kamu,
          buat apa dipakainya, ke mana aja perginya, dan gimana cara kamu minta
          data itu dihapus. Ditulis apa adanya, sesuai fitur yang beneran ada
          di app ini — bukan template generik.
        </p>

        <Section title="1. Data yang Dikumpulkan">
          <p>Lewat login GitHub OAuth, KRYNOS nyimpen:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Username, foto profil, dan access token GitHub kamu (dipakai buat baca/tulis repo atas nama kamu sendiri).</li>
            <li>Waktu pertama & terakhir kamu aktif, plus total durasi pemakaian (buat statistik internal owner, bukan dijual/dibagi ke pihak lain).</li>
          </ul>
          <p>Tergantung fitur yang kamu pakai, ada juga data tambahan:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><b>KRYNOS Plus</b>: nama pengirim transfer, nominal, dan screenshot bukti transfer (disimpan di storage PRIVATE, cuma owner yang bisa lihat buat verifikasi) — atau nama & pesan donasi kalau bayar lewat Saweria.</li>
            <li><b>Komunitas & Survey</b>: isi pesan/komentar/jawaban survey yang kamu kirim sendiri.</li>
            <li><b>Collaboration</b>: kalau kamu diundang jadi collaborator repo orang lain, access token GitHub kamu dipakai server buat proses itu (bukan disimpan ganda, dan tersimpan sama amannya kayak token akun kamu sendiri).</li>
            <li><b>Notifikasi push</b> (kalau kamu aktifin): endpoint & key notifikasi browser/device kamu.</li>
            <li><b>Redeem code / grant Plus gratis</b>: catatan siapa pakai kode apa kapan.</li>
          </ul>
          <p>
            KRYNOS <b>gak pernah</b> minta password GitHub kamu secara
            langsung — proses login sepenuhnya lewat OAuth resmi dari GitHub.
          </p>
        </Section>

        <Section title="2. Buat Apa Data Ini Dipakai">
          <ul className="list-disc pl-4 space-y-1">
            <li>Nampilin & ngedit repo GitHub kamu di dalam app ini.</li>
            <li>Verifikasi pembayaran &amp; aktivasi KRYNOS Plus (manual oleh owner, atau otomatis lewat webhook Saweria).</li>
            <li>Ngirim notifikasi status (Plus aktif/ditolak, undangan collaboration, pengumuman) — baik langsung di dalam app maupun lewat push notification kalau kamu izinin.</li>
            <li>Statistik pemakaian internal, buat owner ngukur seberapa aktif app ini dipakai — ditampilin dalam bentuk angka agregat, bukan per-orang ke pihak luar.</li>
            <li>Moderasi (misalnya nge-ban akun yang melanggar) oleh owner/admin.</li>
          </ul>
        </Section>

        <Section title="3. Dibagikan ke Siapa Aja">
          <ul className="list-disc pl-4 space-y-1">
            <li><b>GitHub</b> — karena app ini emang wadah buat ngatur repo GitHub kamu, hampir semua aksi diteruskan langsung ke API resmi GitHub pakai token kamu.</li>
            <li><b>Supabase</b> — database &amp; storage tempat semua data di atas disimpan (server pihak ketiga, bukan server milik KRYNOS sendiri).</li>
            <li><b>Groq</b> — kalau kamu pakai AI code suggestion di editor atau fitur "Analisis dengan AI" buat build log, potongan kode/log yang relevan dikirim ke Groq buat diproses jadi saran/analisis.</li>
            <li><b>Saweria &amp; Vercel/Netlify</b> — kalau kamu donasi lewat Saweria atau app ini nyambung ke deployment Vercel/Netlify kamu, data transaksi/deployment diproses lewat layanan mereka masing-masing sesuai kebijakan privasi mereka sendiri.</li>
          </ul>
          <p>
            KRYNOS <b>gak jual data kamu ke pengiklan</b> dan gak ada iklan
            pihak ketiga di app ini.
          </p>
        </Section>

        <Section title="4. Cookie & Sesi Login">
          <p>
            App ini pakai cookie sesi (NextAuth) buat inget kamu udah login,
            sifatnya HttpOnly (gak bisa diakses JavaScript sembarangan) dan
            cuma dipakai buat keperluan autentikasi — bukan buat tracking
            iklan lintas situs.
          </p>
        </Section>

        <Section title="5. Berapa Lama Data Disimpan">
          <p>
            Data kamu disimpan selama akun kamu aktif dipakai. Kalau kamu
            minta akun dihapus (lihat bagian 6), semua data terkait dihapus
            dari database KRYNOS — kecuali yang emang wajib disimpan
            demi kepatuhan hukum (misal riwayat transaksi Plus, kalau
            berlaku ketentuan perpajakan/pembukuan).
          </p>
        </Section>

        <Section title="6. Hak Kamu">
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Akses & koreksi</b>: data profil (nama, bio, dll) bisa kamu ubah sendiri lewat halaman Settings, karena sumbernya langsung dari profil GitHub kamu.</li>
            <li><b>Hapus data</b>: hubungi owner lewat menu Customer Service di sidebar, atau lewat kontak di bagian bawah halaman ini, buat minta akun & data kamu dihapus dari database KRYNOS.</li>
            <li><b>Cabut izin</b>: kamu bisa cabut akses OAuth KRYNOS kapan aja lewat GitHub → Settings → Applications → Authorized OAuth Apps. Push notification juga bisa dimatiin kapan aja dari pengaturan browser/device kamu.</li>
          </ul>
        </Section>

        <Section title="7. Keamanan">
          <p>
            Access token GitHub kamu disimpan di database dengan akses
            terbatas cuma lewat server (service role), gak pernah
            di-expose ke browser/client secara langsung. Bukti transfer
            Plus disimpan di storage PRIVATE, bukan public link. Meski
            begitu, gak ada sistem yang 100% bebas risiko — kalau kamu
            nemu celah keamanan, laporin ke owner lewat Customer Service.
          </p>
        </Section>

        <Section title="8. Perubahan Kebijakan Ini">
          <p>
            Kalau ada perubahan signifikan ke kebijakan ini, tanggal di
            bagian "Terakhir diperbarui" di atas bakal ikut berubah.
            Perubahan besar (misal ada data baru yang mulai dikumpulkan)
            bakal diumumin lewat menu Announcement.
          </p>
        </Section>

        <Section title="9. Kontak">
          <p>
            Ada pertanyaan soal privasi atau mau minta data dihapus? Buka
            menu <span className="text-accent">Customer Service</span> di
            sidebar app, atau hubungi owner KRYNOS langsung.
          </p>
        </Section>

        <p className="text-center text-[11px] text-gray-500 pt-2">
          Lihat juga{" "}
          <Link href="/about" className="text-accent underline">
            Tentang KRYNOS
          </Link>
        </p>
      </div>
    </main>
  );
}
