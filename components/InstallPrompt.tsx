"use client";

import { useEffect, useState } from "react";
import {
  isStandaloneApp, isIosDevice, isAndroidDevice, subscribeInstallAvailability,
  hasInstallPromptAvailable, triggerInstallPrompt, APKPURE_DOWNLOAD_URL,
} from "@/lib/installPrompt";

const SEEN_KEY = "mc-install-prompt-seen";

// Popup ajakan install — CUMA muncul 1x seumur hidup (pertama kali buka
// website/app), beda dari versi sebelumnya yang muncul tiap buka. Kalau
// user skip, tetep bisa install lewat tombol "Install App" di menu nav
// (lihat InstallNavButton.tsx) kapan aja.
//
// Android -> diarahkan ke APKPure (link download APK langsung), BUKAN lagi
// dialog install PWA browser bawaan — biar user dapet app "beneran" dari
// APKPure (bisa di-rating, dapet update lewat APKPure juga).
// iOS -> tetap instruksi manual "Add to Home Screen" (APK gak jalan di iOS).
export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (isStandaloneApp()) return;

    const alreadySeen = localStorage.getItem(SEEN_KEY) === "1";
    if (alreadySeen) return;

    setIsIos(isIosDevice());
    setIsAndroid(isAndroidDevice());

    // Android & iOS -> langsung tampilin (gak perlu nunggu event apapun,
    // Android sekarang cuma ngarahin ke link APKPure, bukan nunggu
    // beforeinstallprompt lagi).
    if (isIosDevice() || isAndroidDevice()) {
      setShow(true);
      localStorage.setItem(SEEN_KEY, "1");
      return;
    }

    // Desktop/browser lain (APK gak relevan) -> tetap pakai dialog install
    // PWA bawaan browser kayak sebelumnya.
    if (hasInstallPromptAvailable()) {
      setShow(true);
      localStorage.setItem(SEEN_KEY, "1");
      return;
    }
    const unsubscribe = subscribeInstallAvailability((available) => {
      if (available) {
        setShow(true);
        localStorage.setItem(SEEN_KEY, "1");
      }
    });
    return unsubscribe;
  }, []);

  async function handleInstallClick() {
    if (isAndroid) {
      window.open(APKPURE_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
      setShow(false);
      return;
    }
    const accepted = await triggerInstallPrompt();
    if (accepted) setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-2">Install KRYNOS</h2>

        {isIos ? (
          <p className="text-sm text-gray-400 mb-5">
            Tekan tombol <span className="font-medium">Share</span> di
            Safari, lalu pilih{" "}
            <span className="font-medium">&quot;Add to Home Screen&quot;</span>{" "}
            biar KRYNOS bisa dibuka langsung dari home screen kamu.
          </p>
        ) : isAndroid ? (
          <p className="text-sm text-gray-400 mb-5">
            Install KRYNOS lewat APKPure biar dapet aplikasi asli
            (bukan cuma versi web), sekaligus bisa dapet update &amp; kasih
            rating langsung dari sana.
          </p>
        ) : (
          <p className="text-sm text-gray-400 mb-5">
            Install KRYNOS ke perangkat kamu biar bisa dibuka langsung
            dari home screen, tanpa buka browser dulu. Kalau di-skip
            sekarang, kamu masih bisa install kapan aja lewat menu.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setShow(false)}
            className="px-3 py-1.5 rounded-lg text-sm border border-border"
          >
            Nanti
          </button>
          {!isIos && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-lg text-sm bg-accent font-medium"
            >
              {isAndroid ? "Install dari APKPure" : "Install"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
