"use client";

import { useEffect, useState } from "react";
import {
  isStandaloneApp, isIosDevice, isAndroidDevice, subscribeInstallAvailability,
  hasInstallPromptAvailable, triggerInstallPrompt, APKPURE_DOWNLOAD_URL,
} from "@/lib/installPrompt";
import { FaDownload } from "react-icons/fa";

// Tombol ini SENGAJA cuma nongol di website biasa (browser), gak pernah
// muncul kalau lagi dibuka dari dalam app yang udah ke-install/APK —
// gak masuk akal nawarin "install" ke orang yang udah make app-nya.
//
// Android -> klik langsung buka link download APKPure di tab baru (bukan
// dialog install PWA browser lagi).
export default function InstallNavButton({ onNavigate }: { onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (isStandaloneApp()) return;

    if (isIosDevice()) {
      setVisible(true);
      return;
    }

    if (isAndroidDevice()) {
      setIsAndroid(true);
      setVisible(true);
      return;
    }

    setVisible(hasInstallPromptAvailable());
    const unsubscribe = subscribeInstallAvailability(setVisible);
    return unsubscribe;
  }, []);

  async function handleClick() {
    if (isIosDevice()) {
      setShowIosModal(true);
      return;
    }
    if (isAndroid) {
      window.open(APKPURE_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
      onNavigate?.();
      return;
    }
    const accepted = await triggerInstallPrompt();
    if (accepted) onNavigate?.();
  }

  if (!visible) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
      >
        <FaDownload size={14} className="text-gray-500" />
        Install App
      </button>

      {showIosModal && (
        <div
          className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-2">Install KRYNOS</h2>
            <p className="text-sm text-gray-400 mb-5">
              Tekan tombol <span className="font-medium">Share</span> di
              Safari, lalu pilih{" "}
              <span className="font-medium">&quot;Add to Home Screen&quot;</span>.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowIosModal(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-accent font-medium"
              >
                Oke
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
