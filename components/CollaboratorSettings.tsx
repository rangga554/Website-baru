"use client";

import { useEffect, useState } from "react";
import { FaUserPlus, FaTimes } from "react-icons/fa";

export default function CollaboratorSettings({ owner, repo }: { owner: string; repo: string }) {
  const [list, setList] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/collaboration/invite?owner=${owner}&repo=${repo}`);
    if (res.ok) setList(await res.json());
  }

  useEffect(() => {
    load();
  }, [owner, repo]);

  async function invite() {
    if (!username.trim()) return;
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/collaboration/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, invitedLogin: username.trim() }),
      });
      if (res.ok) {
        setUsername("");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal mengirim undangan");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengirim undangan. Cek koneksi internet.");
    } finally {
      setInviting(false);
    }
  }

  async function revoke(invitedLogin: string) {
    if (!confirm(`Cabut akses "${invitedLogin}" dari repo ini?`)) return;
    const res = await fetch("/api/collaboration/invite", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repo, invitedLogin }),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <label className="text-xs text-gray-400">Undang Collaborator (username GitHub)</label>
      <div className="flex gap-2 mt-1">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="username-github"
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={invite}
          disabled={inviting || !username.trim()}
          className="bg-accent px-3 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          <FaUserPlus size={11} /> Undang
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}

      {list.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-panel border border-border rounded-lg px-3 py-2 text-xs">
              <span>
                {c.invited_login}{" "}
                {c.status === "pending" && <span className="text-yellow-400">(menunggu)</span>}
                {c.status === "declined" && <span className="text-red-400">(ditolak)</span>}
                {c.status === "accepted" && <span className="text-green-400">(aktif)</span>}
              </span>
              <button onClick={() => revoke(c.invited_login)} className="text-gray-500 hover:text-red-400">
                <FaTimes size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
