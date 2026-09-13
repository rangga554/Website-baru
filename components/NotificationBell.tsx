"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaBell, FaBullhorn, FaUserPlus, FaCheck, FaTimes, FaCrown, FaShieldAlt } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
};

type Invite = {
  id: string;
  owner_login: string;
  repo: string;
  created_at: string;
};

type PlusSubmission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  computed_days: number;
  final_days: number | null;
  amount_idr: number;
  source: "manual" | "saweria";
  note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type SecurityNotif = {
  id: string;
  type: "password_changed" | "new_device";
  message: string;
  created_at: string;
};

// Announcement & submission Plus sama-sama uuid — dipakein 1 set "read" aja
// (kolisi antar 2 uuid acak dari 2 sumber beda praktis mustahil).
const READ_KEY = "mc_read_notifications";
const MAX_ANNOUNCEMENTS = 8;

function getReadIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markRead(id: string) {
  try {
    const ids = getReadIds();
    if (!ids.includes(id)) {
      const next = [...ids, id].slice(-300); // jangan numpuk selamanya
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    }
  } catch {}
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID");
}

// Notifikasi di samping foto profil — gabungan Announcement (pindah dari
// menu sidebar), undangan Collaboration (accept/decline langsung di sini),
// dan status pengajuan Plus (approved/rejected).
//
// PENTING soal Plus: ini SENGAJA ngambil dari database (GET /api/plus/mine)
// tiap buka dropdown / tiap 15 detik — BUKAN cuma ngandelin Web Push. Push
// notification bisa gagal diem-diem (user belum kasih izin notifikasi
// browser, belum install PWA, browser beda device, dll), jadi biar STATUS
// PLUS BENERAN "WORK" dan kebaca user, sumber utamanya harus yang pasti
// nyampe: dicek langsung tiap kali dropdown ini dibuka/direfresh, bukan
// nunggu push yang gak dijamin sampai.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [plusSubmissions, setPlusSubmissions] = useState<PlusSubmission[]>([]);
  const [securityNotifs, setSecurityNotifs] = useState<SecurityNotif[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(getReadIds());
  }, []);

  async function load() {
    try {
      const [annRes, collabRes, plusRes, securityRes] = await Promise.all([
        fetch("/api/announcements"),
        fetch("/api/collaboration/mine"),
        fetch("/api/plus/mine"),
        fetch("/api/notifications/security"),
      ]);
      if (annRes.ok) {
        const d = await annRes.json();
        setAnnouncements((d || []).slice(0, MAX_ANNOUNCEMENTS));
      }
      if (collabRes.ok) {
        const d = await collabRes.json();
        setInvites(d.pending || []);
      }
      if (plusRes.ok) {
        const d = await plusRes.json();
        // Cuma yang udah diputusin (approved/rejected) yang jadi notifikasi
        // — status 'pending' gak perlu, user udah tau dia lagi nunggu.
        setPlusSubmissions((d.submissions || []).filter((s: PlusSubmission) => s.status !== "pending"));
      }
      if (securityRes.ok) {
        const d = await securityRes.json();
        setSecurityNotifs(d.notifications || []);
      }
    } catch {
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Auto-refresh senyap tiap 15 detik biar badge & status Plus selalu up to
  // date walau user gak buka dropdown-nya sama sekali.
  useLivePolling(load, 15000, true);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function respondInvite(inviteId: string, accept: boolean) {
    setResponding(inviteId);
    try {
      const res = await fetch("/api/collaboration/mine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId, accept }),
      });
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } finally {
      setResponding(null);
    }
  }

  function markItemRead(id: string) {
    markRead(id);
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function onAnnouncementClick(id: string) {
    markItemRead(id);
    setOpen(false);
  }

  function onPlusClick(sub: PlusSubmission) {
    markItemRead(sub.id);
    setOpen(false);
    // Sidebar yang megang state modal Plus — dipicu lewat custom event biar
    // gak perlu prop-drilling lintas komponen yang gak sejalur langsung.
    window.dispatchEvent(new CustomEvent("mc:open-plus-modal"));
  }

  const unreadAnnouncements = announcements.filter((a) => !readIds.includes(a.id)).length;
  const unreadPlus = plusSubmissions.filter((s) => !readIds.includes(s.id)).length;
  const unreadSecurity = securityNotifs.filter((s) => !readIds.includes(s.id)).length;
  const unreadCount = invites.length + unreadAnnouncements + unreadPlus + unreadSecurity;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative p-2 -mr-1 rounded-md text-gray-300 hover:bg-white/5 active:scale-95"
      >
        <FaBell size={17} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] max-h-[75vh] overflow-y-auto bg-panel border border-border rounded-xl shadow-2xl z-50">
          <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Notifikasi</span>
            {invites.length > 0 && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium">
                {invites.length} undangan
              </span>
            )}
          </div>

          {invites.length > 0 && (
            <div className="border-b border-border">
              {invites.map((inv) => (
                <div key={inv.id} className="px-3.5 py-2.5 flex items-start gap-2.5">
                  <FaUserPlus size={13} className="text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <b>{inv.owner_login}</b> ngundang kamu jadi collaborator di{" "}
                      <b>{inv.repo}</b>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(inv.created_at)}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        disabled={responding === inv.id}
                        onClick={() => respondInvite(inv.id, true)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-accent font-medium disabled:opacity-50"
                      >
                        <FaCheck size={9} /> Terima
                      </button>
                      <button
                        disabled={responding === inv.id}
                        onClick={() => respondInvite(inv.id, false)}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-border disabled:opacity-50"
                      >
                        <FaTimes size={9} /> Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            {loaded &&
              announcements.length === 0 &&
              invites.length === 0 &&
              plusSubmissions.length === 0 &&
              securityNotifs.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-8 px-4">
                  Belum ada notifikasi.
                </p>
              )}

            {securityNotifs.map((s) => {
              const isUnread = !readIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    markItemRead(s.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors border-b border-border last:border-b-0"
                >
                  <FaShieldAlt size={13} className={`shrink-0 mt-0.5 ${isUnread ? "text-red-400" : "text-gray-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${isUnread ? "font-semibold" : "text-gray-300"}`}>
                      {s.type === "password_changed" ? "Password diganti" : "Perangkat baru login"}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{s.message}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(s.created_at)}</p>
                  </div>
                  {isUnread && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-1.5" />}
                </button>
              );
            })}

            {plusSubmissions.map((sub) => {
              const isUnread = !readIds.includes(sub.id);
              const isApproved = sub.status === "approved";
              const days = sub.final_days ?? sub.computed_days;
              return (
                <button
                  key={sub.id}
                  onClick={() => onPlusClick(sub)}
                  className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors border-b border-border last:border-b-0"
                >
                  <FaCrown
                    size={13}
                    className={`shrink-0 mt-0.5 ${
                      isApproved ? (isUnread ? "text-amber-400" : "text-gray-500") : isUnread ? "text-red-400" : "text-gray-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${isUnread ? "font-semibold" : "text-gray-300"}`}>
                      {isApproved
                        ? `Plus kamu aktif! +${days} hari`
                        : "Pengajuan Plus ditolak"}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                      {isApproved
                        ? `Donasi/transfer Rp${sub.amount_idr.toLocaleString("id-ID")} udah dikonfirmasi.`
                        : sub.note || "Cek detail di Owner Panel atau hubungi owner."}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {timeAgo(sub.reviewed_at || sub.created_at)}
                    </p>
                  </div>
                  {isUnread && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${isApproved ? "bg-amber-400" : "bg-red-400"}`}
                    />
                  )}
                </button>
              );
            })}

            {announcements.map((a) => {
              const isUnread = !readIds.includes(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/announcement/${a.id}`}
                  onClick={() => onAnnouncementClick(a.id)}
                  className="px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors border-b border-border last:border-b-0"
                >
                  <FaBullhorn size={13} className={`shrink-0 mt-0.5 ${isUnread ? "text-accent" : "text-gray-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug truncate ${isUnread ? "font-semibold" : "text-gray-300"}`}>
                      {a.title}
                    </p>
                    <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{a.content}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                  {isUnread && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />}
                </Link>
              );
            })}
          </div>

          {announcements.length > 0 && (
            <Link
              href="/announcement"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-accent py-2.5 border-t border-border hover:bg-white/5"
            >
              Lihat semua pengumuman
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
