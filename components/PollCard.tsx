"use client";

import { useEffect, useState } from "react";
import { FaChartBar, FaClock } from "react-icons/fa";

type PollOption = { id: string; label: string };
type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  ends_at: string;
  tally: Record<string, number>;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Selesai";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PollCard({ poll, onVoted }: { poll: Poll; onVoted: () => void }) {
  const [remainingMs, setRemainingMs] = useState(
    new Date(poll.ends_at).getTime() - Date.now()
  );
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(poll.ends_at).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [poll.ends_at]);

  const ended = remainingMs <= 0;
  const totalVotes = Object.values(poll.tally || {}).reduce((a, b) => a + b, 0);

  async function vote(optionId: string) {
    if (ended || voting) return;
    setVoting(true);
    setError("");
    try {
      const res = await fetch("/api/community/poll/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, optionId }),
      });
      if (res.ok) {
        onVoted();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal vote");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal vote. Cek koneksi internet.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="bg-accent/5 border border-accent/30 rounded-xl p-3 max-w-[85%]">
      <div className="flex items-center gap-1.5 text-[10px] text-accent mb-2 font-medium">
        <FaChartBar size={10} /> GLOBAL POLLING
      </div>
      <p className="text-sm font-medium mb-3">{poll.question}</p>

      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const votes = poll.tally?.[opt.id] || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={ended || voting}
              className="w-full relative bg-base border border-border rounded-lg overflow-hidden text-left disabled:cursor-default"
            >
              <div
                className="absolute inset-y-0 left-0 bg-accent/20"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                <span className="truncate">{opt.label}</span>
                <span className="text-gray-400 shrink-0 ml-2">
                  {pct}% ({votes})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}

      <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
        <span>{totalVotes} suara</span>
        <span className="flex items-center gap-1">
          <FaClock size={9} /> {ended ? "Polling ditutup" : formatRemaining(remainingMs)}
        </span>
      </div>
    </div>
  );
}
