"use client";

import { useState } from "react";
import { FaShieldAlt, FaExclamationTriangle, FaQuestionCircle, FaSyncAlt, FaExternalLinkAlt } from "react-icons/fa";

export type WebStoreSite = {
  id: string;
  url: string;
  owner_login: string;
  title: string | null;
  favicon: string | null;
  status: "aman" | "perlu_ditinjau" | "berisiko" | "tidak_terjangkau";
  score: number | null;
  verdict: string | null;
  flags: string[] | null;
  last_checked_at: string | null;
  created_at: string;
};

const STATUS_META: Record<
  WebStoreSite["status"],
  { label: string; color: string; bg: string; Icon: any }
> = {
  aman: { label: "Aman", color: "text-emerald-400", bg: "bg-emerald-400/10", Icon: FaShieldAlt },
  perlu_ditinjau: { label: "Perlu Ditinjau", color: "text-amber-400", bg: "bg-amber-400/10", Icon: FaQuestionCircle },
  berisiko: { label: "Berisiko", color: "text-red-400", bg: "bg-red-400/10", Icon: FaExclamationTriangle },
  tidak_terjangkau: { label: "Tidak Terjangkau", color: "text-gray-400", bg: "bg-gray-400/10", Icon: FaQuestionCircle },
};

function timeAgo(iso: string | null) {
  if (!iso) return "belum pernah dicek";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function WebStoreCard({
  site,
  isOwner,
  onRescanned,
}: {
  site: WebStoreSite;
  isOwner: boolean;
  onRescanned: (updated: WebStoreSite) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState("");

  const meta = STATUS_META[site.status] || STATUS_META.perlu_ditinjau;

  async function rescan() {
    setRescanning(true);
    setRescanError("");
    try {
      const res = await fetch(`/api/web-store/${site.id}/rescan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal rescan");
      onRescanned(data.site);
    } catch (e: any) {
      setRescanError(e.message);
    } finally {
      setRescanning(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex items-start gap-3">
        <img
          src={site.favicon || ""}
          alt=""
          className="w-10 h-10 rounded-lg shrink-0 bg-black/30 object-contain"
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate">{site.title || site.url}</p>
          </div>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-500 truncate flex items-center gap-1 hover:text-gray-300"
          >
            {site.url.replace(/^https?:\/\//, "")} <FaExternalLinkAlt size={8} />
          </a>
        </div>
        <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${meta.color} ${meta.bg}`}>
          <meta.Icon size={10} />
          {meta.label}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[11px] text-gray-400 hover:text-gray-200"
      >
        {expanded ? "Sembunyikan detail ▲" : "Lihat detail penilaian AI ▼"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {site.score !== null && (
            <p className="text-xs text-gray-300">
              Skor keamanan data: <b className={meta.color}>{site.score}/100</b>
            </p>
          )}
          {site.verdict && <p className="text-xs text-gray-400 leading-relaxed">{site.verdict}</p>}
          {site.flags && site.flags.length > 0 && (
            <ul className="space-y-1">
              {site.flags.map((f, i) => (
                <li key={i} className="text-[11px] text-amber-300/90 flex items-start gap-1.5">
                  <span className="shrink-0">•</span> {f}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-gray-500">
            Terakhir dicek: {timeAgo(site.last_checked_at)} · Didaftarkan oleh @{site.owner_login}
          </p>

          {isOwner && (
            <div>
              <button
                onClick={rescan}
                disabled={rescanning}
                className="flex items-center gap-1.5 text-[11px] text-accent disabled:opacity-50"
              >
                <FaSyncAlt size={10} className={rescanning ? "animate-spin" : ""} />
                {rescanning ? "Mengecek ulang..." : "Rescan sekarang"}
              </button>
              {rescanError && <p className="text-[11px] text-red-400 mt-1">{rescanError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
