"use client";

import { useEffect, useState } from "react";
import { FaUserShield, FaPlus, FaTrash } from "react-icons/fa";

type AdminRow = { login: string; added_by: string; created_at: string };

// Cuma dirender kalau role.isOwner (lihat app/owner/page.tsx) — tapi
// backend-nya (app/api/owner/admins/*) TETAP dicek isOwner langsung juga,
// bukan isOwnerOrAdmin, biar admin gak bisa nambah/hapus admin lain
// meskipun somehow manggil endpoint-nya langsung.
export default function AdminManagementPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/owner/admins");
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Gagal memuat daftar admin");
    setAdmins(data);
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newLogin.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/owner/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: newLogin.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewLogin("");
      load();
    } catch (e: any) {
      alert(e.message || "Gagal menambah admin");
    } finally {
      setBusy(false);
    }
  }

  async function remove(login: string) {
    if (!confirm(`Cabut akses admin dari "${login}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/owner/admins/${encodeURIComponent(login)}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e: any) {
      alert(e.message || "Gagal menghapus admin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="font-bold flex items-center gap-2 text-yellow-400 mb-1">
        <FaUserShield /> Kelola Admin
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Admin punya akses yang sama kayak kamu di panel ini (moderasi user &amp;
        konten, redeem code, review Plus), TAPI gak bisa apa-apain akun kamu
        (owner), dan gak bisa nambah/hapus admin lain — cuma kamu yang bisa.
      </p>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          value={newLogin}
          onChange={(e) => setNewLogin(e.target.value)}
          placeholder="Username GitHub..."
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !newLogin.trim()}
          className="shrink-0 bg-accent text-black text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
        >
          <FaPlus size={10} /> Tambah
        </button>
      </form>

      {admins.length === 0 && !error && (
        <p className="text-xs text-gray-500">Belum ada admin. Kamu masih satu-satunya yang kelola app ini.</p>
      )}

      <div className="space-y-2">
        {admins.map((a) => (
          <div
            key={a.login}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{a.login}</p>
              <p className="text-[11px] text-gray-500">
                Ditambah oleh {a.added_by} · {new Date(a.created_at).toLocaleDateString("id-ID")}
              </p>
            </div>
            <button
              onClick={() => remove(a.login)}
              disabled={busy}
              className="shrink-0 p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
              title="Cabut akses admin"
            >
              <FaTrash size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
