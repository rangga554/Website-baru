"use client";

import { useEffect, useRef } from "react";

/**
 * Jalanin `callback` berulang tiap `intervalMs`, TAPI otomatis berhenti
 * sementara kalau tab/halaman lagi gak keliatan (background/minimize) —
 * biar gak buang-buang jatah GitHub API call pas gak ada yang lihat.
 * Lanjut lagi otomatis begitu tab dibuka lagi.
 */
export function useLivePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => savedCallback.current(), intervalMs);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled]);
}
