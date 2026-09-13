"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import {
  FaInfoCircle,
  FaArrowLeft,
  FaGithub,
  FaCrown,
  FaFileArchive,
  FaUsers,
  FaClipboardList,
  FaBullhorn,
  FaFlask,
  FaCloud,
  FaHeadset,
  FaCodeBranch,
} from "react-icons/fa";

const FEATURES = [
  {
    icon: FaGithub,
    title: "Login & Editor Langsung dari GitHub",
    desc: "Login pakai akun GitHub, langsung bisa jelajahi & edit file repo dari HP/laptop, tanpa install apa-apa. Ada 2 mode tampilan: Preview (warna syntax highlighting) dan Edit (di PC/laptop tetap berwarna + AI suggestion, di HP pakai mode ringan biar keyboard/clipboard-nya mulus).",
  },
  {
    icon: FaFileArchive,
    title: "Upload & Extract Fleksibel",
    desc: "Upload File, Gambar, atau Folder biasa — gratis buat semua orang. Upload Child Folder Utama & Extract Zip khusus Plus. Ada juga Extract: bongkar file .zip yang udah ada di repo jadi file/folder, atau sebaliknya, bikin ZIP dari semua isi repo buat didownload (\"Extract Your File To Zip\").",
  },
  {
    icon: FaCrown,
    title: "KRYNOS Plus",
    desc: "Upgrade manual via QRIS, mulai Rp10.000 = 7 hari. Cukup transfer, upload bukti transfer, tunggu konfirmasi owner (1 menit–48 jam). Owner juga bisa kasih Plus gratis ke siapa aja lewat Owner Panel.",
  },
  {
    icon: FaUsers,
    title: "Komunitas",
    desc: "Ngobrol & ikutan polling bareng sesama pengguna KRYNOS.",
  },
  {
    icon: FaClipboardList,
    title: "Survey",
    desc: "Isi survey dari owner, termasuk survey \"live\" yang hasilnya real-time.",
  },
  {
    icon: FaBullhorn,
    title: "Announcement",
    desc: "Pengumuman resmi dari owner soal update, kebijakan, atau info penting lainnya — bisa dikomentari.",
  },
  {
    icon: FaFlask,
    title: "Test Project & Deployment",
    desc: "Jalanin GitHub Actions buat testing langsung dari app, plus pantau status & log deployment Vercel/Netlify tanpa perlu buka dashboard lain.",
  },
  {
    icon: FaHeadset,
    title: "Customer Service AI",
    desc: "Asisten AI yang siap jelasin fitur KRYNOS secara detail buat pemula, dan bantu jawab keluhan seputar pemakaian app ini.",
  },
];

export default function AboutPage() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.version && setVersion(d.version))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaInfoCircle className="text-accent" /> Tentang KRYNOS
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <AppLogo size="w-16 h-16" rounded="rounded-2xl" badgeSize="w-6 h-6 text-base" className="mx-auto" />
          <h2 className="text-xl font-bold">
            Master <span className="text-accent">Code</span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            KRYNOS adalah web app buat ngedit &amp; kelola repository GitHub
            langsung dari HP atau laptop kamu — kapan aja, di mana aja, tanpa
            perlu install code editor atau buka terminal.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Fitur Utama
          </h3>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-3 rounded-xl border border-border bg-panel p-3"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FaCloud className="text-accent" size={13} /> Info Teknis
          </h3>
          <p className="text-xs text-gray-400">
            Domain resmi: <span className="text-gray-200">mastercode.my.id</span>
          </p>
          {version && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <FaCodeBranch size={11} /> Versi build: {" "}
              <span className="text-gray-200 font-mono">{version.slice(0, 7)}</span>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-500">
          Ada pertanyaan atau kendala? Buka menu{" "}
          <span className="text-accent">Customer Service</span> di sidebar, AI-nya
          siap bantu jelasin lebih detail. 🙌
        </p>

        <p className="text-center text-xs text-gray-500">
          <Link href="/privacy" className="text-accent underline">
            Kebijakan Privasi
          </Link>
        </p>
      </div>
    </main>
  );
}
