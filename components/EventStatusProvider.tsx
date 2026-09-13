"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { EventPublicStatus } from "@/lib/eventShared";

const DEFAULT_STATUS: EventPublicStatus = { active: false, hutNumber: 81 };

const EventStatusContext = createContext<EventPublicStatus>(DEFAULT_STATUS);

// Satu-satunya tempat yang nge-fetch /api/event/status — komponen lain
// (banner, logo, dll) cukup pakai useEventStatus() di bawah, gak perlu
// fetch sendiri-sendiri. Provider ini juga yang nge-toggle class
// "event-theme" di <html>, yang bikin --accent-rgb di globals.css berubah
// jadi merah -> otomatis nge-recolor SELURUH app (tombol, link, border
// aktif, dst yang pakai text-accent/bg-accent/border-accent) tanpa perlu
// ubah komponen satu-satu.
//
// CATATAN soal "live": ini polling tiap 10 detik, BUKAN Supabase Realtime
// (websocket). Sengaja gitu — Realtime dari browser butuh expose Supabase
// anon key + RLS yang bener, sedangkan project ini didesain semua akses DB
// lewat service role key di server doang (lihat lib/supabase.ts). Nambah
// anon key sekarang berarti buka celah baca-langsung ke semua tabel dari
// browser (karena RLS-nya belum di-aktifin di semua tabel). Polling 10
// detik ini kompromi yang aman: kerasa instan tapi gak nambah attack
// surface. Kalau suatu saat mau upgrade ke Realtime beneran, siapin dulu
// RLS policy yang bener di semua tabel + NEXT_PUBLIC_SUPABASE_ANON_KEY.
export default function EventStatusProvider({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus } = useSession();
  const [event, setEvent] = useState<EventPublicStatus>(DEFAULT_STATUS);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/event/status");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setEvent(data);
      } catch {
        // diem-diem aja, tema/banner emang gak kritis buat jalannya app
      }
    }
    load();
    // Polling ringan tiap 10 detik — biar tema/banner/status Plus kerasa
    // "live" dan nyesuain cepet abis owner pencet tombol di Event Panel.
    // (Bukan Supabase Realtime/websocket beneran — lihat catatan di bawah.)
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionStatus]);

  useEffect(() => {
    document.documentElement.classList.toggle("event-theme", event.active);
  }, [event.active]);

  return <EventStatusContext.Provider value={event}>{children}</EventStatusContext.Provider>;
}

export function useEventStatus(): EventPublicStatus {
  return useContext(EventStatusContext);
}
