"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { FaCrown, FaTimes, FaCheckCircle, FaRedo, FaHeart, FaCopy } from "react-icons/fa";
import { PLUS_PRICE_PER_WEEK_IDR } from "@/lib/plusShared";
import { usePlusStatus } from "@/lib/usePlusStatus";

const SAWERIA_USERNAME = process.env.NEXT_PUBLIC_SAWERIA_USERNAME || "";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// "3 hari 4 jam" / "5 jam 12 menit" / "Kurang dari 1 menit"
function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Sudah habis";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-8">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl my-auto flex flex-col max-h-[85vh]">
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <h2 className="font-bold flex items-center gap-2 text-amber-400">
        <FaCrown /> KRYNOS Plus
      </h2>
      <button onClick={onClose} className="text-gray-400 p-1">
        <FaTimes />
      </button>
    </div>
  );
}

// Tab "Saweria" — donasi lewat Saweria terus Plus aktif OTOMATIS lewat
// webhook (lib/saweria.ts + app/api/plus/saweria-webhook), gak perlu upload
// bukti transfer & gak perlu nunggu owner approve. Syaratnya cuma 1: pas
// donasi, kolom Nama/Pesan WAJIB diisi username GitHub persis, biar sistem
// bisa mencocokkan otomatis donasi itu punya siapa.
function SaweriaTab({ login, onDonate }: { login: string | undefined; onDonate: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyLogin() {
    if (!login) return;
    navigator.clipboard.writeText(login).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-400 leading-relaxed">
        Donasi lewat Saweria, Plus <b className="text-emerald-400">otomatis aktif dalam hitungan detik</b> —
        gak perlu upload bukti transfer & gak perlu nunggu owner konfirmasi.
        Minimal <b>Rp{PLUS_PRICE_PER_WEEK_IDR.toLocaleString("id-ID")}</b> = 1 minggu
        (kelipatan 10rb = kelipatan minggu, sisa yang gak genap kelipatan{" "}
        <b>hangus</b>).
      </div>

      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 space-y-2">
        <p className="text-xs text-amber-300 font-medium">
          ⚠️ WAJIB dibaca sebelum donasi:
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">
          Pas isi form donasi di Saweria, kolom <b>Nama/Pesan</b> harus diisi
          username GitHub kamu <b>PERSIS</b> (huruf besar/kecil bebas), biar
          sistem bisa otomatis nyocokin donasi itu punya akun kamu. Kalau
          lupa/typo, Plus gak bakal otomatis aktif — nanti masuk antrian
          buat dicocokin manual sama owner.
        </p>
        {login && (
          <div className="flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2">
            <code className="text-sm text-emerald-400 flex-1 truncate">{login}</code>
            <button
              onClick={copyLogin}
              className="shrink-0 flex items-center gap-1 text-[11px] text-gray-300 bg-white/5 px-2 py-1 rounded-md active:scale-95"
            >
              <FaCopy size={10} /> {copied ? "Tersalin!" : "Salin"}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onDonate}
        className="w-full flex items-center justify-center gap-2 bg-[#FF823A] text-white font-medium rounded-lg py-2.5 text-sm active:scale-[0.98]"
      >
        <FaHeart size={13} /> Donasi via Saweria
      </button>

      <p className="text-[11px] text-gray-500 text-center">
        Setelah donasi berhasil, halaman ini otomatis update sendiri — gak
        perlu refresh manual.
      </p>
    </div>
  );
}

// CATATAN: sebelumnya di sini ada overlay iframe biar user gak ninggalin
// app KRYNOS buat donasi. Tapi Saweria sengaja NGEBLOK iframe (header
// X-Frame-Options / CSP frame-ancestors) buat cegah clickjacking di
// halaman yang nyangkut duit, jadi overlay itu cuma nampilin halaman
// putih kosong. Sekarang langsung buka tab baru aja, gak ada overlay lagi
// — lihat onDonate di bawah (window.open langsung ke url Saweria).

export default function PlusUpgradeModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const login = (session as any)?.login as string | undefined;
  const { status, loading } = usePlusStatus();
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [method, setMethod] = useState<"saweria" | "qris">(SAWERIA_USERNAME ? "saweria" : "qris");

  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ days: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const amountNumber = Number(amount || 0);
  const estimatedDays =
    amountNumber >= PLUS_PRICE_PER_WEEK_IDR
      ? Math.floor(amountNumber / PLUS_PRICE_PER_WEEK_IDR) * 7
      : 0;

  async function handleProofChange(file: File | null) {
    setProofFile(file);
    if (file) setProofPreview(await readAsBase64(file));
    else setProofPreview("");
  }

  async function handleSubmit() {
    setError("");
    if (!senderName.trim()) return setError("Nama rekening/e-wallet pengirim wajib diisi");
    if (!amountNumber || amountNumber < PLUS_PRICE_PER_WEEK_IDR) {
      return setError(`Minimal transfer Rp${PLUS_PRICE_PER_WEEK_IDR.toLocaleString("id-ID")}`);
    }
    if (!proofPreview) return setError("Bukti transfer (screenshot) wajib diupload");

    setSubmitting(true);
    try {
      const res = await fetch("/api/plus/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          senderName: senderName.trim(),
          amountIdr: amountNumber,
          proofDataUrl: proofPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim bukti transfer");
      setDone({ days: data.computedDays });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Masih loading status pertama kali dibuka
  if (loading) {
    return (
      <ModalShell onClose={onClose}>
        <ModalHeader onClose={onClose} />
        <div className="p-6 text-center text-sm text-gray-400">Memuat status Plus...</div>
      </ModalShell>
    );
  }

  // Sukses submit bukti transfer -> pesan konfirmasi
  if (done) {
    return (
      <ModalShell onClose={onClose}>
        <ModalHeader onClose={onClose} />
        <div className="p-6 text-center overflow-y-auto">
          <FaCheckCircle className="mx-auto text-emerald-400 text-3xl mb-3" />
          <p className="text-sm text-gray-200">
            Bukti transfer terkirim! Estimasi <b>{done.days} hari</b> Plus (menunggu
            konfirmasi owner, 1 menit&ndash;48 jam).
          </p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-accent rounded-lg py-2 text-sm font-medium"
          >
            Tutup
          </button>
        </div>
      </ModalShell>
    );
  }

  // Sudah Plus aktif & belum minta buka form top-up -> tampilan "Info Plus"
  if (status?.active && !showUpgradeForm) {
    return (
      <ModalShell onClose={onClose}>
        <ModalHeader onClose={onClose} />
        <div className="p-6 text-center overflow-y-auto">
          <FaCrown className="mx-auto text-amber-400 text-3xl mb-3" />
          {status.isOwnerAccount ? (
            <p className="text-sm text-gray-200">
              Kamu <b className="text-amber-400">Owner</b> — Plus aktif otomatis,
              selamanya, gratis. 👑
            </p>
          ) : status.eventFree ? (
            <>
              <p className="text-lg mb-1">🇮🇩</p>
              <p className="text-sm text-gray-200">
                <b className="text-red-400">
                  Dirgahayu RI ke-{status.hutNumber ?? "?"}!
                </b>{" "}
                Plus kamu aktif <b className="text-amber-400">GRATIS</b> selama
                event kemerdekaan berlangsung, gak perlu bayar/upload bukti
                transfer.
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Setelah event kelar, Plus balik ke skema normal (top-up mingguan).
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-200">
                Plus kamu aktif, sisa waktu:
              </p>
              <p className="text-2xl font-bold text-amber-400 my-2">
                {formatRemaining(status.expiresAt!)}
              </p>
              <p className="text-[11px] text-gray-500">
                Berakhir: {new Date(status.expiresAt!).toLocaleString("id-ID")}
              </p>
              <button
                onClick={() => setShowUpgradeForm(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-500 text-black font-medium rounded-lg py-2.5 text-sm"
              >
                <FaRedo size={12} /> Top Up / Perpanjang Lagi
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="mt-2 w-full border border-border rounded-lg py-2 text-sm text-gray-400"
          >
            Tutup
          </button>
        </div>
      </ModalShell>
    );
  }

  // Belum Plus (atau lagi mau top-up) -> form upgrade
  return (
    <ModalShell onClose={onClose}>
      <ModalHeader onClose={onClose} />
      <div className="p-4 space-y-4 overflow-y-auto">
        {SAWERIA_USERNAME && (
          <div className="flex bg-black/30 border border-border rounded-lg p-1 gap-1">
            <button
              onClick={() => setMethod("saweria")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium rounded-md py-1.5 transition-colors ${
                method === "saweria" ? "bg-amber-500 text-black" : "text-gray-400"
              }`}
            >
              <FaHeart size={10} /> Saweria (Otomatis)
            </button>
            <button
              onClick={() => setMethod("qris")}
              className={`flex-1 text-xs font-medium rounded-md py-1.5 transition-colors ${
                method === "qris" ? "bg-amber-500 text-black" : "text-gray-400"
              }`}
            >
              QRIS (Manual)
            </button>
          </div>
        )}

        {method === "saweria" && SAWERIA_USERNAME ? (
          <SaweriaTab
            login={login}
            onDonate={() =>
              window.open(`https://saweria.co/${SAWERIA_USERNAME}`, "_blank", "noopener,noreferrer")
            }
          />
        ) : (
          <>
            <div className="text-xs text-gray-400 leading-relaxed">
              Upload Child Folder Utama &amp; Extract Zip khusus untuk pengguna{" "}
              <b className="text-amber-400">Plus</b>. Scan QRIS di bawah, transfer
              minimal <b>Rp{PLUS_PRICE_PER_WEEK_IDR.toLocaleString("id-ID")}</b> = 1
              minggu (kelipatan 10rb = kelipatan minggu). Nominal di bawah 10rb atau
              sisa yang gak genap kelipatan 10rb <b>hangus</b>, gak dihitung. Butuh
              direview owner dulu (1 menit&ndash;48 jam).
            </div>

            {/* Ganti /qris.png ini dengan gambar QRIS kamu sendiri di /public/qris.png */}
            <img
              src="/qris.png"
              alt="QRIS KRYNOS Plus"
              className="w-full rounded-xl border border-border bg-white p-2"
            />

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Nama rekening/e-wallet yang dipakai transfer
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Jumlah transfer (Rp)</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
              />
              {amountNumber > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Estimasi: <b className={estimatedDays > 0 ? "text-emerald-400" : "text-red-400"}>
                    {estimatedDays} hari
                  </b>{" "}
                  {estimatedDays === 0 && "(di bawah minimum, gak akan dihitung owner)"}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Bukti transfer (screenshot)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleProofChange(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-border rounded-lg py-2 text-xs text-gray-400"
              >
                {proofFile ? proofFile.name : "Pilih screenshot bukti transfer"}
              </button>
              {proofPreview && (
                <img
                  src={proofPreview}
                  alt="preview bukti transfer"
                  className="mt-2 rounded-lg max-h-40 mx-auto"
                />
              )}
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-amber-500 text-black font-medium rounded-lg py-2.5 text-sm disabled:opacity-50"
            >
              {submitting ? "Mengirim..." : "Kirim Bukti Transfer"}
            </button>
          </>
        )}

        {status?.active && (
          <button
            onClick={() => setShowUpgradeForm(false)}
            className="w-full text-xs text-gray-500 underline"
          >
            Batal, kembali ke info Plus
          </button>
        )}
      </div>

    </ModalShell>
  );
}
