"use client";

import { useState } from "react";
import { FaUserPlus } from "react-icons/fa";

// Cuma perlu dipencet SEKALI aja (biasanya abis pertama kali deploy fitur
// auto-follow ini) — buat user BARU & yang login ulang, udah otomatis
// ke-handle sendiri lewat lib/auth.ts, gak butuh tombol ini lagi.
export default function AutoFollowBackfillButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string>("");

  async function run() {
    setRunning(true);
    setResult("");
    try {
      const res = await fetch("/api/owner/auto-follow-backfill", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setResult(`Selesai — ${d.processed} user diproses.`);
      } else {
        setResult(`Gagal: ${d.error}`);
      }
    } catch {
      setResult("Gagal: cek koneksi internet.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-panel p-4">
      <p className="text-sm font-medium flex items-center gap-2">
        <FaUserPlus size={13} className="text-accent" /> Auto-Follow Backfill
      </p>
      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
        User baru & yang login ulang otomatis follow akun GitHub kamu
        sendiri. Tombol ini cuma buat user LAMA yang udah pernah login
        SEBELUM fitur ini ada — jalanin sekali aja, gak perlu diulang.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="mt-3 text-xs bg-accent px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
      >
        {running ? "Memproses..." : "Jalankan Backfill"}
      </button>
      {result && <p className="text-xs text-gray-400 mt-2">{result}</p>}
    </div>
  );
}
