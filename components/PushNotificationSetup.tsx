"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const DISMISS_KEY = "mc-push-prompt-dismissed";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  // Sengaja bikin ArrayBuffer eksplisit dulu (bukan langsung `new Uint8Array(length)`)
  // — TypeScript versi baru lebih strict, Uint8Array yang "dibungkus" ArrayBufferLike
  // (bisa jadi SharedArrayBuffer) gak dianggap cocok sama tipe BufferSource yang
  // diminta pushManager.subscribe(). Dengan ArrayBuffer eksplisit, tipenya pasti pas.
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: existing.toJSON() }),
    });
    return;
  }

  const keyRes = await fetch("/api/push/vapid-public-key");
  const { publicKey, configured } = await keyRes.json();
  if (!configured) return; // VAPID belum di-setup di server, diem-diem aja

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
}

// Popup ajakan aktifkan notifikasi — muncul sekali sampai user pilih
// (beda sama InstallPrompt yang sengaja diulang tiap buka).
// - Owner: dapat notif SEMUA (pengajuan Plus baru, dll)
// - User biasa: cuma dapat notif announcement baru
export default function PushNotificationSetup() {
  const { status } = useSession();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const alreadyDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    if (Notification.permission === "granted") {
      subscribeToPush().catch(() => {});
      return;
    }
    if (Notification.permission !== "default" || alreadyDismissed) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await subscribeToPush();
    } catch {
      // diem-diem aja kalau gagal
    }
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[997] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-2">Aktifkan Notifikasi</h2>
        <p className="text-sm text-gray-400 mb-5">
          Dapat kabar begitu ada pengumuman baru dari KRYNOS — nyampe
          langsung ke HP kamu, walau app-nya lagi ditutup.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={dismiss} className="px-3 py-1.5 rounded-lg text-sm border border-border">
            Nanti
          </button>
          <button onClick={enable} className="px-3 py-1.5 rounded-lg text-sm bg-accent font-medium">
            Aktifkan
          </button>
        </div>
      </div>
    </div>
  );
}
