"use client";

import { useEffect, useState } from "react";
import { FaCrown, FaCheck, FaTimes, FaImage, FaHistory, FaGift, FaHeart } from "react-icons/fa";

type Submission = {
  id: string;
  login: string;
  avatar_url: string | null;
  sender_name: string;
  amount_idr: number;
  computed_days: number;
  status: "pending" | "approved" | "rejected";
  final_login: string | null;
  final_days: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  proof_path: string | null;
  source: "manual" | "saweria";
  note: string | null;
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function SubmissionRow({
  submission,
  onDone,
}: {
  submission: Submission;
  onDone: () => void;
}) {
  const [finalLogin, setFinalLogin] = useState(submission.login);
  const [finalDays, setFinalDays] = useState(String(submission.computed_days));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function viewProof() {
    setError("");
    const res = await fetch(`/api/owner/plus/submissions/${submission.id}/proof`);
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Gagal ambil bukti transfer");
    window.open(data.url, "_blank");
  }

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/owner/plus/submissions/${submission.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { action, finalLogin, finalDays: Number(finalDays) }
            : { action }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses submission");
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isPending = submission.status === "pending";

  return (
    <div className="rounded-xl border border-border bg-panel p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {submission.avatar_url && (
            <img src={submission.avatar_url} className="w-6 h-6 rounded-full" alt="" />
          )}
          <span className="text-sm font-medium">{submission.login}</span>
          {submission.source === "saweria" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF823A]/20 text-[#FF823A] font-medium flex items-center gap-1">
              <FaHeart size={8} /> Saweria
            </span>
          )}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              submission.status === "pending"
                ? "bg-amber-500/20 text-amber-400"
                : submission.status === "approved"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {submission.status}
          </span>
        </div>
        <span className="text-[11px] text-gray-500">
          {new Date(submission.created_at).toLocaleString("id-ID")}
        </span>
      </div>

      <div className="text-xs text-gray-400 grid grid-cols-2 gap-1">
        <span>Pengirim: <b className="text-gray-200">{submission.sender_name}</b></span>
        <span>Jumlah: <b className="text-gray-200">{formatRupiah(submission.amount_idr)}</b></span>
        <span>Estimasi hari: <b className="text-gray-200">{submission.computed_days} hari</b></span>
        {submission.status !== "pending" && (
          <span>
            Final: <b className="text-gray-200">{submission.final_days} hari</b> untuk{" "}
            <b className="text-gray-200">{submission.final_login}</b>
          </span>
        )}
      </div>

      {submission.note && (
        <p className="text-[11px] text-gray-500 italic">{submission.note}</p>
      )}

      {submission.proof_path && (
        <button
          onClick={viewProof}
          className="flex items-center gap-1.5 text-xs text-accent underline"
        >
          <FaImage size={11} /> Lihat / download bukti transfer
        </button>
      )}

      {isPending && (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Username tujuan</label>
              <input
                value={finalLogin}
                onChange={(e) => setFinalLogin(e.target.value)}
                className="w-full bg-black/30 border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Jumlah hari Plus</label>
              <input
                type="number"
                min={1}
                value={finalDays}
                onChange={(e) => setFinalDays(e.target.value)}
                className="w-full bg-black/30 border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => act("approve")}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
            >
              <FaCheck size={10} /> Approve
            </button>
            <button
              onClick={() => act("reject")}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/80 rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
            >
              <FaTimes size={10} /> Tolak
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FreeGrantForm({ onDone }: { onDone: () => void }) {
  const [login, setLogin] = useState("");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleGrant() {
    setError("");
    setSuccess("");
    if (!login.trim()) return setError("Username wajib diisi");
    const daysNum = Number(days);
    if (!daysNum || daysNum <= 0) return setError("Jumlah hari gak valid");

    setBusy(true);
    try {
      const res = await fetch("/api/owner/plus/grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: login.trim(), days: daysNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal kasih Plus gratis");
      setSuccess(`Berhasil! ${login.trim()} Plus sampai ${new Date(data.expiresAt).toLocaleString("id-ID")}`);
      setLogin("");
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 mb-3 space-y-2">
      <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
        <FaGift size={11} /> Kasih Plus Gratis (tanpa bukti transfer)
      </p>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Username GitHub"
          className="bg-black/30 border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
        />
        <input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="bg-black/30 border border-border rounded-lg px-2 py-1.5 text-xs outline-none text-center"
        />
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {success && <p className="text-[11px] text-emerald-400">{success}</p>}
      <button
        onClick={handleGrant}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 bg-amber-500 text-black rounded-lg py-1.5 text-xs font-medium disabled:opacity-50"
      >
        <FaGift size={10} /> {busy ? "Mengirim..." : "Kasih Plus"}
      </button>
    </div>
  );
}

export default function PlusReviewPanel() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/owner/plus/submissions${showHistory ? "" : "?status=pending"}`);
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Gagal memuat submission");
    setSubmissions(data);
    setError("");
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2 text-amber-400">
          <FaCrown /> KRYNOS Plus — Konfirmasi Pembayaran
        </h2>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400"
        >
          <FaHistory size={11} /> {showHistory ? "Sembunyikan riwayat" : "Lihat semua"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <FreeGrantForm onDone={load} />
      {submissions.length === 0 && !error && (
        <p className="text-xs text-gray-500">
          {showHistory ? "Belum ada submission sama sekali." : "Tidak ada yang pending."}
        </p>
      )}

      <div className="space-y-2">
        {submissions.map((s) => (
          <SubmissionRow key={s.id} submission={s} onDone={load} />
        ))}
      </div>
    </div>
  );
}
