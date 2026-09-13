"use client";

import { useEffect, useState } from "react";
import RatingPromptModal, { APKPURE_REVIEW_URL } from "./RatingPromptModal";

// ============================================================================
// Kapan popup ajakan rating ini muncul OTOMATIS (client-side murni, gak ada
// SQL/API — semua status disimpen di localStorage BROWSER user):
//
// - Dihitung dari jumlah kali dashboard di-buka (bukan langsung muncul pas
//   buka pertama kali — biar user udah "kenal" dulu sama app-nya)
// - Baru muncul otomatis mulai kunjungan ke-5
// - Kalau ditutup/"Nanti aja" -> muncul lagi 14 hari kemudian
// - Kalau "Jangan tampilkan lagi" ATAU udah pernah klik "Beri Rating" ->
//   gak muncul otomatis lagi SELAMANYA (localStorage device itu)
// ============================================================================

const STORAGE_KEY = "mastercode_rating_prompt";
const MIN_VISITS_BEFORE_SHOW = 5;
const COOLDOWN_DAYS = 14;

type PromptState = {
  visitCount: number;
  dismissedForever: boolean;
  lastShownAt: number | null;
};

function loadState(): PromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage gak ke-akses -> anggap fresh state, gak fatal.
  }
  return { visitCount: 0, dismissedForever: false, lastShownAt: null };
}

function saveState(state: PromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage penuh/diblokir -> ya udah, gak fatal, cuma prompt-nya jadi
    // mungkin muncul lagi lebih sering dari seharusnya.
  }
}

export default function RatingPromptGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const state = loadState();
    const nextVisitCount = state.visitCount + 1;
    const updated: PromptState = { ...state, visitCount: nextVisitCount };
    saveState(updated);

    if (state.dismissedForever) return;
    if (nextVisitCount < MIN_VISITS_BEFORE_SHOW) return;

    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const eligibleByCooldown = !state.lastShownAt || Date.now() - state.lastShownAt > cooldownMs;
    if (!eligibleByCooldown) return;

    // Delay dikit biar gak nabrak sama animasi masuk halaman/popup lain
    // (misal popup install PWA) — kesannya lebih natural, gak "nyerbu".
    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  function markShown(extra: Partial<PromptState> = {}) {
    const state = loadState();
    saveState({ ...state, lastShownAt: Date.now(), ...extra });
  }

  function handleRate() {
    window.open(APKPURE_REVIEW_URL, "_blank", "noopener,noreferrer");
    markShown({ dismissedForever: true }); // udah rating -> gak perlu ditawarin lagi
    setShow(false);
  }

  function handleLater() {
    markShown();
    setShow(false);
  }

  function handleNeverAskAgain() {
    markShown({ dismissedForever: true });
    setShow(false);
  }

  if (!show) return null;

  return (
    <RatingPromptModal
      onRate={handleRate}
      onLater={handleLater}
      onNeverAskAgain={handleNeverAskAgain}
    />
  );
}
