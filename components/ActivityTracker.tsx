"use client";

import { useSession } from "next-auth/react";
import { useLivePolling } from "@/lib/useLivePolling";

// Sama dengan lib/ownerStats.ts PING_INTERVAL_SECONDS (60 detik) — dipisah
// biar file ini gak perlu import lib server-only.
const PING_INTERVAL_MS = 60000;

// Kirim "ping" tiap 1 menit SELAMA user login & tab lagi kebuka/aktif
// (useLivePolling otomatis pause kalau tab di-background). Ini yang jadi
// dasar hitung Waktu Pakai, User Aktif, dan User Terdaftar di Owner Panel.
export default function ActivityTracker() {
  const { status } = useSession();

  useLivePolling(
    () => {
      fetch("/api/activity/ping", { method: "POST" }).catch(() => {
        // Diem-diem aja kalau gagal (network error, dll) — bukan fitur
        // kritis buat user biasa.
      });
    },
    PING_INTERVAL_MS,
    status === "authenticated"
  );

  return null;
}
