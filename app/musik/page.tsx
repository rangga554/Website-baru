"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaMusic,
  FaPlay,
  FaPause,
  FaStepForward,
  FaStepBackward,
  FaSearch,
  FaExclamationTriangle,
  FaSpinner,
  FaFire,
} from "react-icons/fa";
import { useMusicPlayer } from "@/lib/music/MusicPlayerProvider";
import type { MusicTrack } from "@/lib/music/jamendo";

const GENRES = [
  { label: "Populer", tags: "" },
  { label: "Pop", tags: "pop" },
  { label: "Rock", tags: "rock" },
  { label: "Elektronik", tags: "electronic" },
  { label: "Jazz", tags: "jazz" },
  { label: "Akustik", tags: "acoustic" },
  { label: "Klasik", tags: "classical" },
  { label: "Lofi/Chill", tags: "chillout" },
];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusikPage() {
  const player = useMusicPlayer();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    ended,
    autoNextCountdown,
    isBuffering,
    error: playerError,
    playTrack,
    togglePlay,
    playNext,
    playPrev,
    seek,
  } = player;

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState(GENRES[0]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function loadTracks(q: string, tags: string) {
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (tags) qs.set("tags", tags);
    // Kalau lagi search by judul/artis, biarin Jamendo urutin sendiri
    // berdasarkan kecocokan nama — order=popularity_total cuma dipake pas
    // browsing tanpa kata kunci (list "Populer"/genre).
    if (!q.trim()) qs.set("order", "popularity_total");
    fetch(`/api/music/tracks?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setLoadError(data.error);
          setTracks([]);
        } else {
          setTracks(data.tracks || []);
        }
      })
      .catch(() => setLoadError("Gagal muat daftar musik. Cek koneksi internet kamu."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTracks("", GENRES[0].tags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearchChange(v: string) {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadTracks(v, activeGenre.tags), 450);
  }

  function onGenreClick(g: (typeof GENRES)[number]) {
    setActiveGenre(g);
    setSearch("");
    loadTracks("", g.tags);
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaMusic className="text-accent" /> Musik
        </h1>
      </header>

      <div className={`flex-1 overflow-y-auto px-4 py-4 ${currentTrack ? "pb-28" : "pb-6"}`}>
        {/* Search */}
        <div className="relative mb-3">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari judul lagu atau artis..."
            className="w-full bg-panel border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          />
        </div>

        {/* Genre chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 scrollbar-hide">
          {GENRES.map((g) => (
            <button
              key={g.label}
              onClick={() => onGenreClick(g)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeGenre.label === g.label && !search
                  ? "bg-accent text-black border-accent"
                  : "bg-panel text-gray-300 border-border hover:border-white/30"
              }`}
            >
              {g.label === "Populer" && <FaFire className="inline mr-1 -mt-0.5" size={10} />}
              {g.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <FaSpinner className="animate-spin mb-2" size={20} />
            <p className="text-sm">Nyari musik terbaik buat kamu...</p>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-600/40 bg-red-600/10 text-red-400 p-4 text-sm flex items-start gap-2">
            <FaExclamationTriangle className="mt-0.5 shrink-0" /> {loadError}
          </div>
        ) : tracks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-16">Gak ada musik yang ketemu. Coba kata kunci lain.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tracks.map((track) => {
              const active = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  onClick={() => (active ? togglePlay() : playTrack(track, tracks))}
                  className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                    active ? "bg-accent/10 border border-accent/30" : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="w-11 h-11 rounded-lg bg-black/30 shrink-0 overflow-hidden flex items-center justify-center relative">
                    {track.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FaMusic className="text-gray-600" size={14} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${active ? "text-accent" : "text-gray-100"}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{formatTime(track.duration)}</span>
                  <div className="shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                    {active && isPlaying ? <FaPause size={10} /> : <FaPlay size={10} className="ml-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Now playing bar */}
      {currentTrack && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-panel/95 backdrop-blur">
          {ended && autoNextCountdown !== null ? (
            <div className="px-4 py-3 text-center text-xs text-gray-300">
              🎵 Musik telah berakhir! Ayo ganti musik lain atau tunggu{" "}
              <span className="text-accent font-semibold">{autoNextCountdown}s</span> untuk otomatis mencari best
              musik!
            </div>
          ) : (
            <>
              <div className="h-1 bg-white/5 relative">
                <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-10 h-10 rounded-lg bg-black/30 shrink-0 overflow-hidden flex items-center justify-center">
                  {currentTrack.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FaMusic className="text-gray-600" size={12} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentTrack.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {currentTrack.artist} · {formatTime(currentTime)}/{formatTime(duration)}
                  </p>
                </div>
                <button onClick={playPrev} className="p-2 text-gray-300 hover:text-white active:scale-95">
                  <FaStepBackward size={14} />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center active:scale-95"
                >
                  {isBuffering ? (
                    <FaSpinner className="animate-spin" size={13} />
                  ) : isPlaying ? (
                    <FaPause size={13} />
                  ) : (
                    <FaPlay size={13} className="ml-0.5" />
                  )}
                </button>
                <button onClick={playNext} className="p-2 text-gray-300 hover:text-white active:scale-95">
                  <FaStepForward size={14} />
                </button>
              </div>
            </>
          )}
          {playerError && <p className="text-xs text-red-400 text-center pb-2 px-4">{playerError}</p>}
        </div>
      )}
    </main>
  );
}
