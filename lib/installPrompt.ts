"use client";

// Store kecil (bukan React context) buat nyimpen event `beforeinstallprompt`
// biar bisa dipakai bareng oleh 2 tempat: popup pertama-buka (InstallPrompt)
// dan tombol "Install App" yang ada terus di menu nav (InstallNavButton).
// Event ini cuma nge-fire SEKALI per page-load, jadi harus ditangkep &
// disimpen di 1 tempat, bukan didengerin sendiri-sendiri di 2 komponen.

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = (available: boolean) => void;

let deferredEvent: InstallEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;

  // Capacitor (app native) inject object "window.Capacitor" ke WebView-nya.
  // Tanpa cek ini, app native dianggap "browser biasa" (karena
  // matchMedia display-mode & navigator.standalone gak kedetect di
  // Capacitor WebView), jadi popup "Install dari APKPure" ini ikut
  // nongol padahal user udah literally di dalam app-nya.
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// Link download APK langsung dari APKPure (bukan link ulasan) — dipakai
// buat ngarahin instalasi APK di Android ke APKPure, ganti dialog install
// PWA browser bawaan.
export const APKPURE_DOWNLOAD_URL =
  "https://apkpure.com/id/mastercode/com.mastercode/download";

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(window.navigator.userAgent);
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredEvent = e as InstallEvent;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredEvent = null;
    listeners.forEach((l) => l(false));
  });
}

export function subscribeInstallAvailability(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasInstallPromptAvailable(): boolean {
  return !!deferredEvent && !installed;
}

// Trigger dialog install BAWAAN browser (Android/Chrome/Edge). Balikin
// true kalau user beneran nge-klik "Install" di dialog itu.
export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredEvent) return false;
  await deferredEvent.prompt();
  const { outcome } = await deferredEvent.userChoice;
  deferredEvent = null;
  return outcome === "accepted";
}
