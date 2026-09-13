"use client";

import { useState } from "react";
import { FaHistory, FaChevronDown, FaChevronUp } from "react-icons/fa";
import CopyContentButton from "./CopyContentButton";

type ActivityLog = {
  id: string;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

// Label ramah-baca buat tiap kode action (lihat pemanggilan logAction() di
// app/api/**/route.ts). Kode action yang gak ada di map ini bakal
// ditampilin apa adanya.
const ACTION_LABELS: Record<string, string> = {
  ban_user: "Ban user",
  unban_user: "Unban user",
  delete_user_record: "Hapus data user",
  add_admin: "Tambah admin",
  remove_admin: "Cabut akses admin",
  create_redeem_code: "Buat kode redeem",
  delete_redeem_code: "Hapus kode redeem",
  use_redeem_code: "Pakai kode redeem",
  delete_community_message: "Hapus pesan komunitas",
  create_announcement: "Buat pengumuman",
  delete_announcement: "Hapus pengumuman",
  create_social_link: "Tambah link medsos",
  delete_social_link: "Hapus link medsos",
  approve_plus: "Approve Plus",
  reject_plus: "Reject Plus",
  grant_plus_free: "Kasih Plus gratis",
  auto_follow_backfill: "Backfill auto-follow",
};

// Cuma dirender kalau owner (lihat app/owner/page.tsx) — backend-nya
// (/api/owner/logs) juga owner-only, admin gak bisa baca ini biarpun manggil
// endpoint-nya langsung.
export default function ActivityLogsPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      const res = await fetch("/api/owner/logs");
      const data = await res.json();
      if (res.ok) {
        setLogs(data);
        setLoaded(true);
      } else {
        setError(data.error || "Gagal memuat logs");
      }
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-panel px-4 py-3"
      >
        <span className="font-bold flex items-center gap-2 text-accent">
          <FaHistory /> Logs
        </span>
        {open ? <FaChevronUp size={12} className="text-gray-500" /> : <FaChevronDown size={12} className="text-gray-500" />}
      </button>

      {open && (
        <div className="mt-3">
          {loading && <p className="text-xs text-gray-500">Memuat...</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {!loading && !error && logs.length === 0 && (
            <p className="text-xs text-gray-500">Belum ada aktivitas yang tercatat.</p>
          )}

          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-border bg-panel px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs">
                    <span className="text-accent font-medium">{l.actor_login}</span>{" "}
                    <span className="text-gray-400">{ACTION_LABELS[l.action] || l.action}</span>
                  </p>
                  <CopyContentButton
                    getText={() =>
                      `${l.actor_login} — ${ACTION_LABELS[l.action] || l.action}${l.detail ? `\n${l.detail}` : ""}\n${new Date(l.created_at).toLocaleString("id-ID")}`
                    }
                    iconOnly
                    className="shrink-0"
                  />
                </div>
                {l.detail && <p className="text-[11px] text-gray-500 mt-0.5">{l.detail}</p>}
                <p className="text-[10px] text-gray-600 mt-1">
                  {new Date(l.created_at).toLocaleString("id-ID")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
