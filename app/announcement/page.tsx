"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FaBullhorn, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { useRole } from "@/lib/useRole";
import RoleBadge from "@/components/RoleBadge";
import { useLivePolling } from "@/lib/useLivePolling";

export default function AnnouncementListPage() {
  const { data: session } = useSession();
  const login = (session as any)?.login as string | undefined;
  const owner = useRole(login).isPrivileged;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/announcements");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // List pengumuman auto-update tiap 5 detik, tanpa reload halaman.
  useLivePolling(load, 5000, true);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) {
        setTitle("");
        setContent("");
        setShowCreate(false);
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal membuat pengumuman");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal membuat pengumuman. Cek koneksi internet.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus pengumuman ini? Komentarnya ikut kehapus.")) return;
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <FaBullhorn className="text-accent" /> Announcement
          </h1>
          <Link href="/dashboard" className="text-xs text-gray-400 underline">
            Kembali
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {owner && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 bg-accent py-2.5 rounded-lg text-sm font-medium mb-5"
          >
            <FaPlus size={12} /> Buat Pengumuman
          </button>
        )}

        {loading && <p className="text-sm text-gray-500">Memuat...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-10">Belum ada pengumuman.</p>
        )}

        <div className="space-y-3">
          {items.map((a) => (
            <div
              key={a.id}
              className="bg-panel border border-border rounded-xl p-4 hover:border-accent transition-colors"
            >
              <Link href={`/announcement/${a.id}`} className="block">
                <h2 className="font-semibold mb-1">{a.title}</h2>
                <p className="text-sm text-gray-400 line-clamp-2">{a.content}</p>
                <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-2">
                  <img src={a.avatar_url} className="w-4 h-4 rounded-full" />
                  {a.created_by} <RoleBadge login={a.created_by} /> ·{" "}
                  {new Date(a.created_at).toLocaleDateString("id-ID")}
                </div>
              </Link>
              {owner && (
                <button
                  onClick={() => remove(a.id)}
                  className="flex items-center gap-1 text-[11px] text-red-400 mt-2"
                >
                  <FaTrash size={9} /> Hapus
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Buat Pengumuman</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">
                <FaTimes size={16} />
              </button>
            </div>

            <label className="text-xs text-gray-400">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 mb-3 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />

            <label className="text-xs text-gray-400">Isi Pengumuman</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full mt-1 mb-4 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
            />

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg mb-3">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={saving || !title.trim() || !content.trim()}
              className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Mempublikasikan..." : "Publikasikan"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
