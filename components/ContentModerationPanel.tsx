"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaComments, FaTrash, FaBullhorn } from "react-icons/fa";

export default function ContentModerationPanel() {
  const [messages, setMessages] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [msgRes, annRes] = await Promise.all([
        fetch("/api/community/messages"),
        fetch("/api/announcements"),
      ]);
      if (msgRes.ok) {
        const d = await msgRes.json();
        setMessages((d.messages || []).slice(-15).reverse());
      }
      if (annRes.ok) {
        setAnnouncements((await annRes.json()).slice(0, 10));
      }
    } catch {
      setError("Gagal memuat konten");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteMessage(id: string) {
    if (!confirm("Hapus pesan ini?")) return;
    const res = await fetch(`/api/community/messages/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm("Hapus pengumuman ini? Komentarnya ikut kehapus.")) return;
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="font-bold flex items-center gap-2 text-accent mb-3">
        <FaComments /> Moderasi Konten
      </h2>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <div>
        <p className="text-xs text-gray-400 font-medium mb-2">
          15 Pesan Komunitas Terbaru
        </p>
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 mb-4">Belum ada pesan di sesi ini.</p>
        )}
        <div className="space-y-1.5 mb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-panel px-3 py-2"
            >
              <p className="text-xs min-w-0 truncate">
                <span className="text-gray-400">{m.login}:</span>{" "}
                {m.type === "text" ? m.content : `[${m.type}]`}
              </p>
              <button
                onClick={() => deleteMessage(m.id)}
                className="shrink-0 text-gray-500 hover:text-red-400 p-1"
              >
                <FaTrash size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1.5">
          <FaBullhorn size={10} /> Announcement
        </p>
        {announcements.length === 0 && (
          <p className="text-xs text-gray-500">Belum ada pengumuman.</p>
        )}
        <div className="space-y-1.5">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-panel px-3 py-2"
            >
              <Link href={`/announcement/${a.id}`} className="text-xs min-w-0 truncate hover:underline">
                {a.title}
              </Link>
              <button
                onClick={() => deleteAnnouncement(a.id)}
                className="shrink-0 text-gray-500 hover:text-red-400 p-1"
              >
                <FaTrash size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
