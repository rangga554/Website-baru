"use client";

import { useState } from "react";

export default function NewRepoModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [gitignore, setGitignore] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) {
      setError("Nama repository wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/github/create-repo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        isPrivate,
        autoInit: true,
        gitignoreTemplate: gitignore || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Gagal membuat repository");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Repository Baru</h2>

        {error && (
          <p className="text-sm text-red-400 mb-3 bg-red-950/40 p-2 rounded-lg">{error}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400">Nama repository</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="nama-repo-keren"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Deskripsi (opsional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Tentang repo ini..."
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">.gitignore template (opsional)</label>
            <input
              value={gitignore}
              onChange={(e) => setGitignore(e.target.value)}
              className="w-full mt-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Node, Python, dll"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="accent-accent"
            />
            Jadikan private
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-medium active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Membuat..." : "Buat Repo"}
          </button>
        </div>
      </div>
    </div>
  );
}
