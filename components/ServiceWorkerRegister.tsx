"use client";

import { useEffect } from "react";

// Daftarin service worker (public/sw.js) begitu app dimuat di browser.
// Ini yang bikin KRYNOS bisa "Add to Home Screen" / di-install
// sebagai PWA dan tetap bisa kebuka (splash + shell statis) walau
// sinyal internet lagi jelek.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Diem-diem aja kalau gagal register (misal browser lama) — app
      // tetap jalan normal sebagai web biasa, cuma gak bisa di-install.
    });
  }, []);

  return null;
}
