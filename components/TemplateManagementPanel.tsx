"use client";

import { useEffect, useState } from "react";
import { FaLayerGroup, FaTrash, FaPlus } from "react-icons/fa";

type TemplateRow = {
  id: string;
  title: string;
  repo_owner: string;
  repo_name: string;
  created_by: string;
  created_at: string;
};

export default function TemplateManagementPanel() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat Template");
      setTemplates(data);
      setError("");
    } catch (e: any) {
      setError(e.message || "Gagal memuat Template");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setFormError("");
    if (!title.trim()) return setFormError("Judul wajib diisi");
    if (!repoUrl.trim()) return setFormError("Link repo wajib diisi");

    setBusy(true);
    try {
      const res = await fetch("/api/owner/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), repoUrl: repoUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah Template");
      setTitle("");
      setRepoUrl("");
      await load();
    } catch (e: any) {
      setFormError(e.message || "Gagal menambah Template");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus Template ini? User gak akan bisa Get lagi setelah ini.")) return;
    try {
      const res = await fetch(`/api/owner/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      await load();
    } catch (e: any) {
      setError(e.message || "Gagal menghapus");
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-4">
        <FaLayerGroup className="text-accent" size={14} />
        Kelola Template
      </h2>

      {/* Form tambah */}
      <div className="bg-panel border border-border rounded-lg p-4 mb-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul Template (contoh: Next.js + Tailwind Starter)"
          className="w-full bg-black/20 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full bg-black/20 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {formError && <p className="text-xs text-red-400">{formError}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 bg-accent text-black text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50 active:scale-[0.98] transition"
        >
          <FaPlus size={12} />
          {busy ? "Menambah..." : "Tambah Template"}
        </button>
        <p className="text-[11px] text-gray-500">
          Link repo ini TIDAK PERNAH ditampilkan ke user — cuma dipakai server buat proses Get
          (star + copy isi repo ke akun user).
        </p>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {loading ? (
        <p className="text-xs text-gray-500">Memuat...</p>
      ) : templates.length === 0 ? (
        <p className="text-xs text-gray-500">Belum ada Template.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between gap-3 bg-panel border border-border rounded-lg px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{tpl.title}</p>
                <p className="text-xs text-gray-500 truncate">
                  {tpl.repo_owner}/{tpl.repo_name}
                </p>
              </div>
              <button
                onClick={() => remove(tpl.id)}
                className="shrink-0 p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition"
                aria-label="Hapus template"
              >
                <FaTrash size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
