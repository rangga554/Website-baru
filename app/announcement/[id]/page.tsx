"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FaBullhorn, FaPaperPlane, FaClock } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import RoleBadge from "@/components/RoleBadge";

function formatResetCountdown(nextResetAt: string): string {
  const ms = new Date(nextResetAt).getTime() - Date.now();
  if (ms <= 0) return "sebentar lagi";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}d`;
}

export default function AnnouncementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();

  const [items, setItems] = useState<any[] | null>(null);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [nextResetAt, setNextResetAt] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const all = await res.json();
        setItems(all);
        setAnnouncement(all.find((a: any) => a.id === id) || null);
      }
    })();
  }, [id]);

  async function loadComments() {
    const res = await fetch(`/api/announcements/${id}/comments`);
    if (res.ok) {
      const d = await res.json();
      setComments(d.comments);
      setNextResetAt(d.nextResetAt);
    }
  }

  useEffect(() => {
    loadComments();
  }, [id]);

  useLivePolling(loadComments, 5000, true);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function sendComment() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/announcements/${id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        setText("");
        loadComments();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal mengirim komentar");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengirim komentar. Cek koneksi internet.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2 min-w-0">
            <FaBullhorn className="text-accent shrink-0" />
            <span className="truncate">Announcement</span>
          </h1>
          <Link href="/announcement" className="text-xs text-gray-400 underline shrink-0 ml-2">
            Kembali
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          {!announcement ? (
            <p className="text-sm text-gray-500">Memuat...</p>
          ) : (
            <>
              <h2 className="font-semibold text-lg mb-1">{announcement.title}</h2>
              <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2">
                {announcement.content}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <img src={announcement.avatar_url} className="w-4 h-4 rounded-full" />
                {announcement.created_by} <RoleBadge login={announcement.created_by} /> ·{" "}
                {new Date(announcement.created_at).toLocaleString("id-ID")}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium">
              Komentar ({comments.length})
            </p>
            {nextResetAt && (
              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                <FaClock size={9} /> Reset dalam {formatResetCountdown(nextResetAt)}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">
                Belum ada komentar. Jadi yang pertama!
              </p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <img src={c.avatar_url} className="w-7 h-7 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1.5 flex-wrap">
                    {c.login} <RoleBadge login={c.login} /> ·{" "}
                    <span className="text-gray-600">
                      {new Date(c.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="text-sm bg-panel border border-border rounded-lg px-3 py-2 break-words">
                    {c.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 px-4 py-2 mx-4 rounded-lg mb-2">
          {error}
        </p>
      )}

      <div className="border-t border-border p-3 flex items-center gap-2 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendComment()}
          placeholder="Tulis komentar..."
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={sendComment}
          disabled={sending || !text.trim()}
          className="shrink-0 p-2.5 rounded-lg bg-accent disabled:opacity-50"
        >
          <FaPaperPlane size={14} />
        </button>
      </div>
    </main>
  );
}
