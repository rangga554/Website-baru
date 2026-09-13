"use client";

import { useEffect, useRef, useState } from "react";
import { useLivePolling } from "@/lib/useLivePolling";

// Cek versi deployment tiap 30 detik. Kalau beda dari versi yang lagi
// dimuat browser sekarang, berarti sudah ada deployment baru di Vercel —
// munculin popup ajakin refresh. 30 detik dipilih karena ini cuma ngecek
// 1 string kecil (bukan data GitHub), jadi gak masalah buat jatah rate
// limit; dibikin gak terlalu sering juga biar gak buang-buang function
// invocation Vercel buat hal yang jarang berubah.
const CHECK_INTERVAL_MS = 30000;

// Delay sebelum popup ditampilin, dihitung SEJAK update baru kedetect —
// biar gak langsung "nyamber" begitu ketauan ada versi baru (misal kasih
// jeda biar deployment baru itu bener-bener kelar & stabil dulu).
const SHOW_POPUP_DELAY_MS = 15000;

export default function UpdateChecker() {
  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const currentVersion = useRef<string | null>(null);
  const initialized = useRef(false);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function checkVersion() {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { version } = await res.json();

      if (!initialized.current) {
        // Panggilan pertama cuma buat nyimpen versi awal, bukan buat
        // dibandingin (belum ada apa-apa buat dibandingkan).
        currentVersion.current = version;
        initialized.current = true;
        return;
      }

      if (
        currentVersion.current &&
        version !== currentVersion.current &&
        !dismissed &&
        !delayTimer.current
      ) {
        // Update kedetect, tapi popup baru muncul 15 detik kemudian
        // (bukan langsung saat itu juga).
        delayTimer.current = setTimeout(() => {
          setShowPopup(true);
          delayTimer.current = null;
        }, SHOW_POPUP_DELAY_MS);
      }
    } catch {
      // Diem-diem aja kalau network error pas ngecek — bukan hal kritis,
      // coba lagi di interval berikutnya.
    }
  }

  useEffect(() => {
    checkVersion();
    return () => {
      if (delayTimer.current) clearTimeout(delayTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLivePolling(checkVersion, CHECK_INTERVAL_MS, true);

  function handleRefresh() {
    window.location.reload();
  }

  function handleCancel() {
    setShowPopup(false);
    setDismissed(true);
  }

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-2">KRYNOS telah Update</h2>
        <p className="text-sm text-gray-400 mb-5">
          Mohon pencet tombol Refresh untuk memuat versi terbaru.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-lg text-sm border border-border"
          >
            Batal
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-lg text-sm bg-accent font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
