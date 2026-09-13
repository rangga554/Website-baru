"use client";

import { useState } from "react";
import Link from "next/link";
import { FaArrowLeft, FaGift, FaCrown, FaFolderPlus, FaCheckCircle, FaExternalLinkAlt } from "react-icons/fa";

type RedeemResult = {
  rewardType: "plus" | "new_repo" | "custom";
  message: string;
  extra?: { expiresAt?: string; repoUrl?: string; repoName?: string };
};

export default function CodeRedeemPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RedeemResult | null>(null);

  async function handleRedeem() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal redeem kode");
      setResult(data);
      setCode("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const rewardIcon =
    result?.rewardType === "plus" ? FaCrown : result?.rewardType === "new_repo" ? FaFolderPlus : FaGift;
  const RewardIcon = rewardIcon;

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaGift className="text-accent" /> Code Redeem
        </h1>
      </header>

      <div className="max-w-sm mx-auto px-4 py-8 space-y-5">
        {!result ? (
          <>
            <p className="text-sm text-gray-400 text-center">
              Punya kode hadiah dari KRYNOS? Masukin di sini buat langsung
              klaim hadiahnya.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              placeholder="Masukin kode di sini"
              className="w-full text-center tracking-widest uppercase bg-black/30 border border-border rounded-xl px-4 py-3 text-lg font-mono outline-none focus:border-accent"
            />
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              className="w-full bg-accent rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Mengecek kode..." : "Redeem"}
            </button>
          </>
        ) : (
          <div className="text-center space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-6">
            <FaCheckCircle className="mx-auto text-emerald-400 text-3xl" />
            <p className="text-sm font-semibold text-emerald-400">Kode berhasil di-redeem!</p>
            <div className="flex items-center justify-center gap-2 text-gray-200">
              <RewardIcon className="text-amber-400" />
              <span className="font-medium">{result.message}</span>
            </div>

            {result.rewardType === "new_repo" && result.extra?.repoUrl && (
              <a
                href={result.extra.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-accent underline mt-1"
              >
                Buka repository baru <FaExternalLinkAlt size={10} />
              </a>
            )}
            {result.rewardType === "plus" && result.extra?.expiresAt && (
              <p className="text-[11px] text-gray-500">
                Plus aktif sampai {new Date(result.extra.expiresAt).toLocaleString("id-ID")}
              </p>
            )}

            <button
              onClick={() => setResult(null)}
              className="w-full mt-2 border border-border rounded-lg py-2 text-sm text-gray-400"
            >
              Redeem kode lain
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
