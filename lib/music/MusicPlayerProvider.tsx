"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { MusicTrack } from "./jamendo";

const AUTO_NEXT_COUNTDOWN = 10; // detik — waktu tunggu sebelum auto pindah ke best musik
const STORAGE_KEY = "mc_music_playback";
const RESTORE_TTL_MS = 3 * 60 * 60 * 1000; // 3 jam — di atas ini dianggap basi, gak di-restore

type MusicPlayerState = {
  playlist: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  ended: boolean;
  autoNextCountdown: number | null;
  error: string | null;
  playTrack: (track: MusicTrack, list?: MusicTrack[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  seek: (time: number) => void;
  dismissEndedCard: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerState | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer harus dipake di dalam MusicPlayerProvider");
  return ctx;
}

// Sama kayak yang di useMusicPlayer, tapi gak throw error — buat komponen
// yang boleh render meskipun provider belum siap (mis. dipanggil di luar body).
export function useMusicPlayerSafe() {
  return useContext(MusicPlayerContext);
}

export default function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Waktu putar terakhir yang mau di-restore pas track pertama kali dimuat
  // ulang (dari localStorage) — dipake sekali doang, abis itu di-null-in.
  const restoreTimeRef = useRef<number | null>(null);
  // Nandain lagi proses restore abis refresh/buka tab baru, biar play()
  // yang gagal (kena autoplay policy browser) gak ditampilin sebagai error
  // ke user — itu wajar & bukan bug, tinggal user pencet play sekali.
  const isRestoringRef = useRef(false);

  const [playlist, setPlaylist] = useState<MusicTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clearCountdown() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setAutoNextCountdown(null);
  }

  // Nyimpen "lagu apa + di detik berapa" ke localStorage, biar pas user
  // refresh/reload/buka tab baru, lagu yang lagi diputer gak "ilang" gitu
  // aja — begitu app kebuka lagi, langsung ke-restore ke posisi terakhir
  // (tinggal pencet play kalau browsernya nolak autoplay tanpa gesture).
  function savePlaybackState(track: MusicTrack | null, time: number) {
    try {
      if (!track) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ track, time, savedAt: Date.now() }));
    } catch {
      // localStorage penuh/diblokir (mode private dll) — gak fatal, cuma
      // berarti fitur resume abis reload gak jalan, musik tetep bisa diputer.
    }
  }

  const playTrack = useCallback((track: MusicTrack, list?: MusicTrack[]) => {
    clearCountdown();
    setError(null);
    setEnded(false);
    if (list) setPlaylist(list);
    setCurrentTrack(track);
    // Efek di bawah yang beneran nge-set src & play() begitu currentTrack berubah.
  }, []);

  // Cari lagu terpopuler di provider (Jamendo) buat auto-next — ini yang
  // dipanggil kalau countdown abis, atau kalau user pencet "Next" pas udah
  // di ujung playlist.
  const fetchAndPlayBest = useCallback(
    async (excludeId?: string) => {
      try {
        setIsBuffering(true);
        const res = await fetch(`/api/music/best${excludeId ? `?exclude=${excludeId}` : ""}`).then((r) => r.json());
        if (res.error) {
          setError(res.error);
          return;
        }
        clearCountdown();
        setError(null);
        setEnded(false);
        setPlaylist((prev) => (prev.some((t) => t.id === res.track.id) ? prev : [...prev, res.track]));
        setCurrentTrack(res.track);
      } catch {
        setError("Gagal nyari musik terbaru. Cek koneksi internet kamu.");
      } finally {
        setIsBuffering(false);
      }
    },
    []
  );

  const playNext = useCallback(() => {
    if (!currentTrack) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    if (idx >= 0 && idx < playlist.length - 1) {
      playTrack(playlist[idx + 1]);
    } else {
      fetchAndPlayBest(currentTrack.id);
    }
  }, [currentTrack, playlist, playTrack, fetchAndPlayBest]);

  const playPrev = useCallback(() => {
    if (!currentTrack) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) playTrack(playlist[idx - 1]);
  }, [currentTrack, playlist, playTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (ended) {
      // Lagu abis & user pencet play lagi -> ulang dari awal, batalin auto-next.
      clearCountdown();
      setEnded(false);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    if (isPlaying) {
      audio.pause();
      savePlaybackState(currentTrack, audio.currentTime);
    } else audio.play().catch(() => setError("Gagal muter musik ini. Coba pilih musik lain."));
  }, [isPlaying, ended, currentTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const dismissEndedCard = useCallback(() => {
    clearCountdown();
    setEnded(false);
  }, []);

  // Sekali doang pas provider pertama kali mount (buka app/refresh/tab
  // baru) — cek localStorage, kalau ada sesi terakhir yang belum basi,
  // muat lagi track-nya (posisi detiknya ke-restore di effect di bawah).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { track: MusicTrack; time: number; savedAt: number };
      if (!saved?.track || Date.now() - saved.savedAt > RESTORE_TTL_MS) return;
      restoreTimeRef.current = saved.time || 0;
      isRestoringRef.current = true;
      setCurrentTrack(saved.track);
    } catch {
      // data korup/gak valid -> abaikan aja, mulai dari kosong kayak biasa.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Begitu currentTrack ganti, load src baru & langsung play. Kalau ini
  // hasil restore abis reload, seek ke detik terakhir dulu, dan kalau
  // play()-nya ditolak browser (autoplay policy tanpa gesture user) JANGAN
  // ditampilin sebagai error — itu normal, user tinggal pencet play.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = currentTrack.audioUrl;

    if (restoreTimeRef.current != null) {
      const t = restoreTimeRef.current;
      restoreTimeRef.current = null;
      const applySeek = () => {
        audio.currentTime = t;
        setCurrentTime(t);
        audio.removeEventListener("loadedmetadata", applySeek);
      };
      audio.addEventListener("loadedmetadata", applySeek);
    }

    const wasRestoring = isRestoringRef.current;
    isRestoringRef.current = false;
    audio.play().catch(() => {
      if (!wasRestoring) setError("Gagal muter musik ini. Coba pilih musik lain.");
    });

    // Cuma nyimpen state "track baru, detik 0" kalau ini beneran pemilihan
    // baru dari user — pas restore, biarin entry localStorage yang lama
    // (dengan waktu yang bener) tetap utuh sampe auto-save 5 detikan
    // berikutnya nimpa dengan posisi yang udah jalan lagi.
    if (!wasRestoring) savePlaybackState(currentTrack, 0);
  }, [currentTrack]);

  // Auto-save posisi putar tiap 5 detik selama musik jalan — biar kalau
  // tiba-tiba di-refresh/ditutup tanpa sempat pause, posisi terakhirnya
  // tetep ke-simpen (gak cuma pas pause doang).
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const interval = setInterval(() => {
      if (audioRef.current) savePlaybackState(currentTrack, audioRef.current.currentTime);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  // Jaring pengaman terakhir: pas tab/app beneran mau ditutup atau
  // di-refresh, simpen posisi detik paling akhir yang sempat kepantau.
  useEffect(() => {
    function handleBeforeUnload() {
      if (currentTrack && audioRef.current) savePlaybackState(currentTrack, audioRef.current.currentTime);
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [currentTrack]);

  // Mulai hitung mundur auto-next begitu lagu abis.
  useEffect(() => {
    if (!ended) return;
    setAutoNextCountdown(AUTO_NEXT_COUNTDOWN);
    countdownTimer.current = setInterval(() => {
      setAutoNextCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          fetchAndPlayBest(currentTrack?.id);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  return (
    <MusicPlayerContext.Provider
      value={{
        playlist,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        isBuffering,
        ended,
        autoNextCountdown,
        error,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seek,
        dismissEndedCard,
      }}
    >
      {children}
      {/* Audio element beneran, disembunyiin — semua kontrol lewat context di atas. */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setEnded(true);
        }}
        onError={() => setError("Gagal muat file musiknya. Coba pilih musik lain.")}
        // SENGAJA bukan className="hidden" (display:none) — di beberapa
        // browser Android/WebView, audio yang display:none gampang
        // di-suspend/dimatiin browser pas ada halaman berat lagi jalan
        // (kayak Monaco Editor di /editor, banyak Web Worker-nya). Dengan
        // tetap "hidup" secara layout (cuma 0px & gak keliatan), audio
        // terus jalan mulus pindah-pindah halaman, termasuk pas ngedit.
        style={{ position: "fixed", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
    </MusicPlayerContext.Provider>
  );
}
