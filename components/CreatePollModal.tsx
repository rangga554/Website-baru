"use client";

import { useState } from "react";
import { FaPlus, FaTimes } from "react-icons/fa";

export default function CreatePollModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [minutes, setMinutes] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/community/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          options: options.filter((o) => o.trim()),
          durationSeconds: minutes * 60,
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal membuat polling");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal membuat polling. Cek koneksi internet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Buat Global Polling</h2>
          <button onClick={onClose} className="text-gray-400">
            <FaTimes size={16} />
          </button>
        </div>

        <label className="text-xs text-gray-400">Pertanyaan</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Misal: Fitur apa yang paling kamu tunggu?"
          className="w-full mt-1 mb-3 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="text-xs text-gray-400">Opsi jawaban</label>
        <div className="space-y-2 mt-1 mb-2">
          {options.map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Opsi ${i + 1}`}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          ))}
        </div>
        {options.length < 6 && (
          <button
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="flex items-center gap-1.5 text-xs text-accent mb-3"
          >
            <FaPlus size={10} /> Tambah opsi
          </button>
        )}

        <label className="text-xs text-gray-400">Durasi (menit)</label>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
          className="w-full mt-1 mb-4 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg mb-3">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={saving || !question.trim() || options.filter((o) => o.trim()).length < 2}
          className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Membuat..." : "Sematkan Polling"}
        </button>
      </div>
    </div>
  );
}
