"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaKey,
  FaSyncAlt,
  FaCopy,
  FaTrash,
  FaCheck,
} from "react-icons/fa";

// ============================================================================
// GENERATOR KODE UNIK — murni client-side, gak ada API/SQL sama sekali.
// Riwayat kode yang pernah di-generate disimpan di localStorage BROWSER
// masing-masing (bukan di server/akun), jadi:
// - Gak nyangkut data user manapun, gak perlu login
// - Riwayatnya CUMA ada di device/browser itu — kalau ganti device/browser
//   atau clear browser data, riwayatnya ilang (ini disengaja, bukan bug)
// ============================================================================

const STORAGE_KEY = "mastercode_kode_unik_history";
const MAX_HISTORY = 50;

type CharsetKey = "alfanumerik" | "huruf" | "angka" | "angka_simbol";

const CHARSETS: Record<CharsetKey, { label: string; chars: string }> = {
  alfanumerik: { label: "Huruf + Angka", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" },
  huruf: { label: "Huruf saja", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" },
  angka: { label: "Angka saja", chars: "0123456789" },
  angka_simbol: { label: "Huruf + Angka + Simbol", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*" },
};

type HistoryItem = { code: string; createdAt: number };

// crypto.getRandomValues jauh lebih acak & gak bisa ditebak dibanding
// Math.random() — penting kalau kode ini dipakai buat hal yang perlu
// susah ditebak (voucher, token, dll), bukan cuma acak-acakan biasa.
function generateCode(length: number, charset: string): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

export default function KodeUnikPage() {
  const [length, setLength] = useState(8);
  const [charsetKey, setCharsetKey] = useState<CharsetKey>("alfanumerik");
  const [current, setCurrent] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // localStorage gak ke-akses (mode privat dll) -> biarin kosong,
      // fitur generate tetep jalan cuma riwayatnya gak ke-save.
    }
  }, []);

  function saveHistory(next: HistoryItem[]) {
    setHistory(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage penuh/diblokir -> generate tetep jalan, cuma gak ke-save.
    }
  }

  function handleGenerate() {
    const code = generateCode(length, CHARSETS[charsetKey].chars);
    setCurrent(code);
    const next = [{ code, createdAt: Date.now() }, ...history].slice(0, MAX_HISTORY);
    saveHistory(next);
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  function removeItem(code: string, createdAt: number) {
    saveHistory(history.filter((h) => !(h.code === code && h.createdAt === createdAt)));
  }

  function clearAll() {
    saveHistory([]);
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaKey className="text-accent" /> Kode Unik
        </h1>
      </header>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-5">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          Generate string kode acak (voucher, ID unik, token, dll). Riwayatnya
          disimpan cuma di browser ini (localStorage), gak dikirim ke server.
        </p>

        {/* Pengaturan panjang */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">
            Panjang kode: <span className="text-white font-medium">{length} digit</span>
          </label>
          <input
            type="range"
            min={4}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>4</span>
            <span>64</span>
          </div>
        </div>

        {/* Pengaturan tipe karakter */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Tipe karakter</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CHARSETS) as CharsetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setCharsetKey(key)}
                className={`text-xs px-3 py-2 rounded-lg border text-left ${
                  charsetKey === key
                    ? "bg-accent/15 border-accent text-accent"
                    : "bg-panel border-border text-gray-400"
                }`}
              >
                {CHARSETS[key].label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 bg-accent rounded-lg py-2.5 text-sm font-medium"
        >
          <FaSyncAlt size={12} /> Generate Kode
        </button>

        {/* Hasil terbaru, ditonjolin */}
        {current && (
          <div className="bg-panel border border-accent/40 rounded-xl p-4 text-center">
            <p className="font-mono text-lg break-all tracking-wide">{current}</p>
            <button
              onClick={() => copy(current)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent"
            >
              {copiedCode === current ? <FaCheck size={11} /> : <FaCopy size={11} />}
              {copiedCode === current ? "Tersalin" : "Salin"}
            </button>
          </div>
        )}

        {/* Riwayat */}
        {history.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">Riwayat ({history.length})</p>
              <button onClick={clearAll} className="text-[11px] text-red-400">
                Hapus semua
              </button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {history.map((h) => (
                <div
                  key={`${h.code}-${h.createdAt}`}
                  className="flex items-center justify-between gap-2 bg-panel border border-border rounded-lg px-3 py-2"
                >
                  <span className="font-mono text-xs truncate">{h.code}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copy(h.code)} className="text-gray-400 hover:text-accent">
                      {copiedCode === h.code ? <FaCheck size={11} /> : <FaCopy size={11} />}
                    </button>
                    <button
                      onClick={() => removeItem(h.code, h.createdAt)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
