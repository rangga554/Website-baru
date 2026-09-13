"use client";

import { useEffect, useState } from "react";
import { FaGift, FaTrash, FaPlus } from "react-icons/fa";

type RedeemCodeRow = {
  id: string;
  code: string;
  reward_type: "plus" | "new_repo" | "custom";
  reward_days: number | null;
  reward_message: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
};

function CreateCodeForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [rewardType, setRewardType] = useState<"plus" | "new_repo" | "custom">("plus");
  const [rewardDays, setRewardDays] = useState("7");
  const [rewardMessage, setRewardMessage] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!code.trim()) return setError("Kode wajib diisi");

    setBusy(true);
    try {
      const res = await fetch("/api/owner/redeem-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          rewardType,
          rewardDays: rewardType === "plus" ? Number(rewardDays) : undefined,
          rewardMessage: rewardMessage.trim() || undefined,
          maxUses: Number(maxUses),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kode");
      setCode("");
      setRewardMessage("");
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 mb-3 space-y-2">
      <p className="text-xs font-medium text-accent flex items-center gap-1.5">
        <FaPlus size={10} /> Tambah Code Redeem
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="KODE (misal: LEBARAN2026)"
        className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase outline-none"
      />

      <select
        value={rewardType}
        onChange={(e) => setRewardType(e.target.value as any)}
        className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
      >
        <option value="plus">🎗️ KRYNOS Plus Gratis</option>
        <option value="new_repo">📁 File Gratis (Repository Baru)</option>
        <option value="custom">🎁 Lainnya (pesan custom)</option>
      </select>

      {rewardType === "plus" && (
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Durasi Plus (hari)</label>
          <input
            type="number"
            min={1}
            value={rewardDays}
            onChange={(e) => setRewardDays(e.target.value)}
            className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
          />
        </div>
      )}

      {rewardType === "new_repo" && (
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">
            Isi README repo baru (opsional)
          </label>
          <textarea
            value={rewardMessage}
            onChange={(e) => setRewardMessage(e.target.value)}
            placeholder="Contoh: Makasih udah ikutan event KRYNOS! Isi repo ini bebas kamu edit."
            rows={2}
            className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none"
          />
        </div>
      )}

      {rewardType === "custom" && (
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Pesan hadiah</label>
          <textarea
            value={rewardMessage}
            onChange={(e) => setRewardMessage(e.target.value)}
            placeholder="Contoh: Selamat! Kamu dapat merchandise KRYNOS, hubungi owner buat klaim."
            rows={2}
            className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Maks. pemakaian</label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Kadaluarsa (opsional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full bg-black/30 border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none"
          />
        </div>
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 bg-accent rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {busy ? "Menyimpan..." : "Buat Kode"}
      </button>
    </div>
  );
}

export default function RedeemCodePanel() {
  const [codes, setCodes] = useState<RedeemCodeRow[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/owner/redeem-codes");
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Gagal memuat kode");
    setCodes(data);
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Hapus kode redeem ini?")) return;
    const res = await fetch(`/api/owner/redeem-codes/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const rewardLabel = (r: RedeemCodeRow) =>
    r.reward_type === "plus"
      ? `Plus ${r.reward_days} hari`
      : r.reward_type === "new_repo"
      ? "Repo Baru"
      : "Custom";

  return (
    <div className="mt-6">
      <h2 className="font-bold flex items-center gap-2 text-accent mb-3">
        <FaGift /> Code Redeem
      </h2>

      <CreateCodeForm onCreated={load} />

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {codes.length === 0 && !error && (
        <p className="text-xs text-gray-500">Belum ada kode redeem.</p>
      )}

      <div className="space-y-2">
        {codes.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-border bg-panel p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-mono font-medium truncate">{c.code}</p>
              <p className="text-[11px] text-gray-500">
                {rewardLabel(c)} · dipakai {c.used_count}/{c.max_uses}
                {c.expires_at && ` · exp ${new Date(c.expires_at).toLocaleDateString("id-ID")}`}
              </p>
            </div>
            <button
              onClick={() => remove(c.id)}
              className="shrink-0 text-gray-500 hover:text-red-400 p-2"
            >
              <FaTrash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
