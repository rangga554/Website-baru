"use client";

import { useEffect, useState } from "react";
import { FaUsersCog, FaBan, FaCheck, FaTrash } from "react-icons/fa";

type ManagedUser = {
  login: string;
  avatar_url: string | null;
  first_seen: string;
  last_seen: string;
  total_active_seconds: number;
  banned: boolean;
  banned_reason: string | null;
  banned_at: string | null;
};

export default function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busyLogin, setBusyLogin] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/owner/users");
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Gagal memuat daftar user");
    setUsers(data);
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function ban(login: string) {
    const reason = prompt(`Alasan ban ${login} (opsional):`) || undefined;
    setBusyLogin(login);
    try {
      const res = await fetch(`/api/owner/users/${encodeURIComponent(login)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ban", reason }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e: any) {
      alert(e.message || "Gagal ban user");
    } finally {
      setBusyLogin(null);
    }
  }

  async function unban(login: string) {
    setBusyLogin(login);
    try {
      const res = await fetch(`/api/owner/users/${encodeURIComponent(login)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unban" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e: any) {
      alert(e.message || "Gagal unban user");
    } finally {
      setBusyLogin(null);
    }
  }

  async function remove(login: string) {
    if (!confirm(`Hapus data tracking user "${login}"? Ini gak ngapus akun GitHub-nya, cuma record aktivitasnya di sini.`)) return;
    setBusyLogin(login);
    try {
      const res = await fetch(`/api/owner/users/${encodeURIComponent(login)}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e: any) {
      alert(e.message || "Gagal hapus user");
    } finally {
      setBusyLogin(null);
    }
  }

  const filtered = users.filter((u) => u.login.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h2 className="font-bold flex items-center gap-2 text-accent mb-3">
        <FaUsersCog /> Manajemen User
      </h2>

      {error && (
        <p className="text-xs text-red-400 mb-2">
          {error}
          {error.includes("banned") && (
            <span className="block mt-1 text-red-300/70">
              Kolom &quot;banned&quot; belum ada di tabel user_activity — lihat komentar di lib/userManagement.ts.
            </span>
          )}
        </p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari username..."
        className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent mb-3"
      />

      {filtered.length === 0 && !error && (
        <p className="text-xs text-gray-500">Belum ada user yang ke-track.</p>
      )}

      <div className="space-y-2">
        {filtered.map((u) => (
          <div
            key={u.login}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel p-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {u.avatar_url ? (
                <img src={u.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {u.login}
                  {u.banned && (
                    <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full shrink-0">
                      Diblokir
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  Terakhir aktif {new Date(u.last_seen).toLocaleDateString("id-ID")}
                  {u.banned_reason && ` · alasan: ${u.banned_reason}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {u.banned ? (
                <button
                  onClick={() => unban(u.login)}
                  disabled={busyLogin === u.login}
                  className="p-2 text-gray-400 hover:text-green-400 disabled:opacity-50"
                  title="Unban"
                >
                  <FaCheck size={13} />
                </button>
              ) : (
                <button
                  onClick={() => ban(u.login)}
                  disabled={busyLogin === u.login}
                  className="p-2 text-gray-400 hover:text-yellow-400 disabled:opacity-50"
                  title="Ban"
                >
                  <FaBan size={13} />
                </button>
              )}
              <button
                onClick={() => remove(u.login)}
                disabled={busyLogin === u.login}
                className="p-2 text-gray-400 hover:text-red-400 disabled:opacity-50"
                title="Hapus data tracking"
              >
                <FaTrash size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
