"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaMusic } from "react-icons/fa";
import { useMusicPlayerSafe } from "@/lib/music/MusicPlayerProvider";

export default function MusicDisc() {
  const player = useMusicPlayerSafe();
  const router = useRouter();
  const pathname = usePathname();

  if (!player || !player.currentTrack) return null;
  if (pathname === "/musik") return null; // udah di halaman musik, gak perlu widget dobel

  const { currentTrack, isPlaying, ended, autoNextCountdown, isBuffering } = player;

  return (
    <div className="fixed z-[996] right-4 bottom-6 flex flex-col items-end gap-2">
      {ended && autoNextCountdown !== null && (
        <div className="max-w-[220px] rounded-xl border border-accent/30 bg-[#181818] shadow-xl p-3 text-xs text-gray-200">
          <p>
            🎵 Musik telah berakhir! Ayo ganti musik lain atau tunggu{" "}
            <span className="text-accent font-semibold">{autoNextCountdown}s</span> untuk otomatis mencari best
            musik!
          </p>
          <button
            onClick={() => router.push("/musik")}
            className="mt-2 w-full text-center bg-accent/15 text-accent rounded-lg py-1.5 font-medium hover:bg-accent/25"
          >
            Ganti musik sekarang
          </button>
        </div>
      )}

      <button
        onClick={() => router.push("/musik")}
        aria-label="Buka player musik"
        className="relative w-14 h-14 rounded-full shadow-lg active:scale-95 transition-transform"
      >
        <div
          className={`w-full h-full rounded-full border-4 border-[#111] bg-[#181818] bg-cover bg-center overflow-hidden flex items-center justify-center ${
            isPlaying && !ended ? "animate-[spin_4s_linear_infinite]" : ""
          }`}
          style={currentTrack.cover ? { backgroundImage: `url(${currentTrack.cover})` } : undefined}
        >
          {!currentTrack.cover && <FaMusic className="text-gray-500" size={18} />}
          {/* Lubang piringan di tengah, biar keliatan kayak vinyl beneran */}
          <div className="absolute w-3 h-3 rounded-full bg-[#0a0d12] border border-black/40" />
        </div>

        {isBuffering && (
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        )}

        {!isPlaying && !ended && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
          </div>
        )}
      </button>
    </div>
  );
}
