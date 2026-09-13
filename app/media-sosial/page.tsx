"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaPlus, FaTimes, FaTrash, FaShareAlt } from "react-icons/fa";
import { useRole } from "@/lib/useRole";
import { detectSocialPlatform } from "@/lib/socialIcons";
import { useLivePolling } from "@/lib/useLivePolling";

type SocialLink = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  created_at: string;
};

function AddSocialModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const preview = url ? detectSocialPlatform(url) : null;

  async function submit() {
    setError("");
    if (!title.trim()) return setError("Judul wajib diisi");
    if (!url.trim()) return setError("Link wajib diisi");

    setSaving(true);
    try {
      const res = await fetch("/api/social-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah link");
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-8">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl my-auto flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="font-bold">Tambah Media Sosial</h2>
          <button onClick={onClose} className="text-gray-400 p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: TikTok KRYNOS"
              className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Deskripsi (opsional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Tips & update seputar KRYNOS"
              className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Link</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tiktok.com/@akunkamu"
              className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
            />
            {preview && (
              <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                <preview.Icon size={11} style={{ color: preview.color }} />
                Kedeteksi sebagai: <b className="text-gray-300">{preview.name}</b>
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-accent rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MediaSocialPage() {
  const { data: session } = useSession();
  const login = (session as any)?.login as string | undefined;
  const owner = useRole(login).isPrivileged;

  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const res = await fetch("/api/social-links");
    if (res.ok) setLinks(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // List link media sosial auto-update tiap 5 detik, tanpa reload halaman.
  useLivePolling(load, 5000, true);

  async function remove(id: string) {
    if (!confirm("Hapus link media sosial ini?")) return;
    const res = await fetch(`/api/social-links/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menghapus: " + (d.error || "unknown error"));
    }
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
            <FaArrowLeft size={16} />
          </Link>
          <h1 className="font-bold flex items-center gap-2">
            <FaShareAlt className="text-accent" /> Media Sosial KRYNOS
          </h1>
        </div>
        {owner && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-accent rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <FaPlus size={11} /> Tambah
          </button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {loading && <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>}
        {!loading && links.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-10">
            Belum ada link media sosial.
          </p>
        )}

        {links.map((link) => {
          const { Icon, color, name } = detectSocialPlatform(link.url);
          return (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-panel p-3"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div
                  className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{link.title}</p>
                  {link.description && (
                    <p className="text-xs text-gray-400 truncate">{link.description}</p>
                  )}
                  <p className="text-[11px] text-gray-500 truncate">{name}</p>
                </div>
              </a>
              {owner && (
                <button
                  onClick={() => remove(link.id)}
                  className="shrink-0 text-gray-500 hover:text-red-400 p-2"
                >
                  <FaTrash size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && <AddSocialModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </main>
  );
}
