"use client";

import { useEffect, useRef, useState } from "react";
import { FaFire, FaCheck } from "react-icons/fa";

// Ikon Daily Rewards — klik buat buka kalender check-in bulan ini. Hari
// yang udah di-check-in (bagian dari streak aktif) ditandain flame kecil,
// hari ini punya tombol "Check-in" kalau belum di-klik hari ini.
//
// CATATAN FIX: sebelumnya ikon api dikasih gradient pake trik
// "bg-clip-text text-transparent" — itu trik buat elemen TEKS, sedangkan
// FaFire dari react-icons render-nya SVG (bukan teks), jadi trik itu gak
// nempel dan ikonnya malah keliatan transparan/ilang. Sekarang pakai warna
// solid biasa (currentColor via class Tailwind), yang emang cara benar buat
// ngasih warna ke ikon SVG.
export default function DailyRewardsFlame({ className = "" }: { className?: string }) {
  const [streak, setStreak] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [lastCheckinDate, setLastCheckinDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function loadStatus() {
    try {
      const res = await fetch("/api/daily-rewards");
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak);
        setCheckedIn(data.checkedInToday);
        setLastCheckinDate(data.lastCheckinDate);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  // Klik di luar popover -> tutup
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleCheckin() {
    if (checkedIn || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/daily-rewards", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || "Gagal check-in");
        setTimeout(() => setToast(null), 2500);
        return;
      }
      setCheckedIn(true);
      setStreak(data.streak);
      if (!data.alreadyCheckedIn) {
        setToast(`+${data.minutesGranted} menit Plus gratis! Streak ${data.streak} hari 🔥`);
        setTimeout(() => setToast(null), 3500);
      }
      await loadStatus();
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <div className={`w-9 h-9 ${className}`} />;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={checkedIn ? `Udah check-in hari ini — streak ${streak} hari` : "Klik buat check-in"}
        className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-transform active:scale-90 hover:scale-110 ${className}`}
      >
        <FaFire
          size={26}
          className={checkedIn ? "text-orange-500 drop-shadow-[0_0_5px_rgba(255,90,0,0.65)]" : "text-gray-600"}
          style={checkedIn ? { animation: "daily-flame-flicker 1.4s ease-in-out infinite" } : undefined}
        />
        {streak > 0 && (
          <span
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold pt-1 ${
              checkedIn ? "text-white" : "text-gray-400"
            }`}
            style={{ textShadow: checkedIn ? "0 0 3px rgba(0,0,0,0.7)" : undefined }}
          >
            {streak}
          </span>
        )}
      </button>

      {toast && (
        <div className="absolute top-11 right-0 z-50 w-52 bg-panel border border-accent/40 rounded-lg px-3 py-2 text-xs text-gray-200 shadow-xl">
          {toast}
        </div>
      )}

      {open && (
        <CheckinCalendar
          streak={streak}
          checkedInToday={checkedIn}
          lastCheckinDate={lastCheckinDate}
          claiming={claiming}
          onCheckin={handleCheckin}
        />
      )}

      <style jsx global>{`
        @keyframes daily-flame-flicker {
          0%,
          100% {
            transform: scale(1) translateY(0);
            filter: brightness(1);
          }
          25% {
            transform: scale(1.06) translateY(-1px);
            filter: brightness(1.15);
          }
          50% {
            transform: scale(0.97) translateY(0.5px);
            filter: brightness(0.95);
          }
          75% {
            transform: scale(1.03) translateY(-0.5px);
            filter: brightness(1.1);
          }
        }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Kalender check-in — nampilin bulan berjalan, tandain hari-hari yang
// termasuk STREAK AKTIF (dihitung mundur dari lastCheckinDate sepanjang
// `streak` hari, gak butuh tabel riwayat terpisah). Hari ini bisa diklik
// buat check-in kalau belum.
// ----------------------------------------------------------------------------
function CheckinCalendar({
  streak,
  checkedInToday,
  lastCheckinDate,
  claiming,
  onCheckin,
}: {
  streak: number;
  checkedInToday: boolean;
  lastCheckinDate: string | null;
  claiming: boolean;
  onCheckin: () => void;
}) {
  // Tanggal WIB "hari ini" dihitung di client apa adanya (buat nentuin sel
  // mana yang "hari ini") — validasi beneran soal boleh/gaknya check-in
  // tetap di server (WIB juga), ini cuma buat tampilan.
  const todayWIB = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [y, m, d] = todayWIB.split("-").map(Number);

  // Set semua tanggal (YYYY-MM-DD) yang termasuk streak aktif, dihitung
  // mundur dari lastCheckinDate.
  const streakDates = new Set<string>();
  if (lastCheckinDate && streak > 0) {
    const base = new Date(`${lastCheckinDate}T00:00:00`);
    for (let i = 0; i < streak; i++) {
      const dt = new Date(base);
      dt.setDate(dt.getDate() - i);
      streakDates.add(dt.toLocaleDateString("en-CA"));
    }
  }

  const firstOfMonth = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=Minggu
  const monthLabel = firstOfMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="absolute top-11 right-0 z-50 w-64 bg-panel border border-border rounded-xl p-3 shadow-2xl">
      <p className="text-xs font-medium text-gray-200 mb-2 text-center capitalize">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
          <span key={i} className="text-[9px] text-gray-500">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = day === d;
          const isStreakDay = streakDates.has(dateStr);

          if (isToday && !checkedInToday) {
            return (
              <button
                key={i}
                onClick={onCheckin}
                disabled={claiming}
                title="Check-in hari ini"
                className="w-7 h-7 rounded-full bg-accent text-white text-[11px] font-semibold flex items-center justify-center active:scale-90 disabled:opacity-50 mx-auto"
              >
                {claiming ? "…" : day}
              </button>
            );
          }

          return (
            <span
              key={i}
              className={`w-7 h-7 rounded-full text-[11px] flex items-center justify-center mx-auto ${
                isStreakDay
                  ? "bg-orange-500/20 text-orange-400 font-semibold"
                  : isToday
                  ? "border border-accent text-gray-300"
                  : "text-gray-500"
              }`}
            >
              {isStreakDay ? <FaFire size={11} /> : day}
            </span>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <FaFire size={10} className="text-orange-400" /> Streak {streak} hari
        </span>
        {checkedInToday && (
          <span className="flex items-center gap-1 text-green-400">
            <FaCheck size={9} /> Udah check-in
          </span>
        )}
      </div>
    </div>
  );
}
