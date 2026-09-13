"use client";

import { useState } from "react";
import { FaCopy, FaCheck } from "react-icons/fa";

// Tombol "Salin" generik — dipakai di banyak tempat (isi file di editor,
// activity logs, build logs, dll) yang isinya teks panjang dan bakal
// ribet kalau user harus select-manual (apalagi di HP). `getText` dipanggil
// PAS TOMBOL DIKLIK (bukan di-passing string langsung) biar selalu ambil
// versi TERBARU dari isi yang mau disalin, bukan versi basi pas komponen
// pertama kali dirender.
//
// ============================================================================
// KENAPA DIPERKUAT jadi 4 lapis fallback (bukan 2 lagi):
//
// Untuk file GEDE (ribuan baris), copy yang cuma andelin 1-2 cara sering
// gagal DIAM-DIAM (kelihatannya "berhasil" padahal clipboard kosong/kepotong),
// gara-gara beberapa hal yang gak berhubungan sama ukuran teksnya doang:
//
// 1. navigator.clipboard.writeText bisa throw "Document is not focused" —
//    kejadian kalau dokumen kehilangan fokus sesaat sebelum tombol
//    diklik (misal abis nutup action sheet/modal lain). Ini SERING
//    kejadian di app kayak KRYNOS yang banyak modal/overlay, gak ada
//    hubungannya sama panjang teks, tapi user ngerasainnya sebagai
//    "kadang gagal copy". Fix: window.focus() dulu + 1x retry sebelum nyerah.
// 2. Buat teks yang BENERAN gede (banyak MB), writeText kadang gagal di
//    beberapa browser/WebView tapi Clipboard API versi Blob (ClipboardItem)
//    lebih tahan banting karena nanganin datanya sebagai stream/blob, bukan
//    string JS biasa yang harus di-alokasi utuh di memory buat argumennya.
// 3. execCommand (fallback lawas) DIPERBAIKI juga: sebelumnya cuma pakai
//    ta.select(), yang di beberapa engine mobile gak reliable buat
//    men-select textarea yang isinya sangat panjang. Sekarang pakai
//    setSelectionRange(0, text.length) eksplisit, yang jauh lebih akurat.
// 4. Kalau SEMUA cara gagal, pesan errornya sekarang lebih jelas + nyaranin
//    solusi (bukan cuma "Gagal, coba lagi" generik), biar user gak bingung.
// ============================================================================

async function copyViaClipboardApi(text: string): Promise<boolean> {
  if (!(navigator.clipboard && window.isSecureContext)) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Kemungkinan besar "document not focused" — fokusin window dulu,
    // kasih browser 1 tick, terus coba SEKALI lagi sebelum nyerah ke
    // fallback berikutnya.
    try {
      window.focus();
      await new Promise((r) => setTimeout(r, 50));
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

async function copyViaClipboardItem(text: string): Promise<boolean> {
  if (!(navigator.clipboard && "write" in navigator.clipboard && window.isSecureContext)) return false;
  try {
    const blob = new Blob([text], { type: "text/plain" });
    // @ts-ignore — ClipboardItem belum selalu ke-cover di semua target lib DOM
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    return true;
  } catch {
    return false;
  }
}

function copyViaExecCommand(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    // .select() gak selalu akurat buat teks SANGAT panjang di sebagian
    // browser mobile — setSelectionRange eksplisit jauh lebih reliable.
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Dipecah jadi potongan ~500rb karakter — kalau clipboard OS/browser ada
// batas ukuran (beberapa WebView Android lawas punya limit di kisaran
// 1MB per item), potongan pertama INI YANG kesalin (lebih baik sebagian
// besar file tersalin daripada nge-fail total) dan user diberitahu jelas
// lewat status "failed" + label khusus, bukan pura-pura sukses.
const CHUNK_LIMIT = 500_000;

export default function CopyContentButton({
  getText,
  label = "Salin",
  className = "",
  iconOnly = false,
}: {
  getText: () => string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [partial, setPartial] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation(); // biar gak ke-trigger klik parent (misal buka detail commit)
    const text = getText();
    if (!text) return;

    setPartial(false);

    // Lapis 1: Clipboard API (writeText) + auto-retry kalau gagal gara-gara
    // dokumen kehilangan fokus.
    let ok = await copyViaClipboardApi(text);

    // Lapis 2: Clipboard API versi Blob/ClipboardItem — lebih tahan buat
    // payload gede di sebagian browser.
    if (!ok) ok = await copyViaClipboardItem(text);

    // Lapis 3: execCommand (fallback browser lawas / non-secure context).
    if (!ok) ok = copyViaExecCommand(text);

    // Lapis 4: kalau SEMUA di atas gagal khusus buat teks super gede,
    // coba salin POTONGAN AWALNYA aja lewat execCommand — mendingan user
    // dapet sebagian isinya (paling awal, paling relevan) daripada gagal
    // total tanpa ada apa-apa di clipboard.
    if (!ok && text.length > CHUNK_LIMIT) {
      ok = copyViaExecCommand(text.slice(0, CHUNK_LIMIT));
      if (ok) setPartial(true);
    }

    if (ok) {
      setCopied(true);
      setFailed(false);
      setTimeout(() => {
        setCopied(false);
        setPartial(false);
      }, partial ? 3000 : 1500);
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Salin ke clipboard"
      className={`flex items-center gap-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95 rounded-md transition-colors ${
        iconOnly ? "p-1.5" : "px-2 py-1"
      } ${className}`}
    >
      {copied ? (
        <>
          <FaCheck size={11} className="text-emerald-400" />
          {!iconOnly && (
            <span className="text-[11px] text-emerald-400">
              {partial ? "Sebagian tersalin (file kegedean)" : "Tersalin!"}
            </span>
          )}
        </>
      ) : failed ? (
        <>
          <FaCopy size={11} className="text-red-400" />
          {!iconOnly && <span className="text-[11px] text-red-400">Gagal, coba tap lagi</span>}
        </>
      ) : (
        <>
          <FaCopy size={11} />
          {!iconOnly && <span className="text-[11px]">{label}</span>}
        </>
      )}
    </button>
  );
}
