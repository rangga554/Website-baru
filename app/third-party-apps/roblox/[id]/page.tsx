"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaSpinner, FaExclamationTriangle, FaPlus, FaFile, FaTrash, FaArchive, FaPen, FaSave } from "react-icons/fa";

type Place = { id: number; name: string; isRootPlace?: boolean };

export default function RobloxPlacesPage() {
  const params = useParams();
  const router = useRouter();
  const universeId = params.id as string;

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/roblox-connect/universes/${universeId}/places`).then((r) => r.json());
    if (res.error) setError(res.error);
    else setPlaces(res.places || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [universeId]);

  async function createPlace() {
    if (!newName.trim()) return;
    setCreateBusy(true);
    try {
      const res = await fetch(`/api/roblox-connect/universes/${universeId}/places`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Gagal: ${data.error}`);
        return;
      }
      setNewName("");
      setCreating(false);
      await load();
    } finally {
      setCreateBusy(false);
    }
  }

  async function removePlace(p: Place) {
    if (p.isRootPlace) {
      alert("Ini root Place — Roblox tidak mengizinkan root Place dihapus sendiri. Arsipkan Universe-nya kalau memang mau menghapus semuanya.");
      return;
    }
    if (!confirm(`Hapus Place "${p.name}"? Ini akan melepasnya dari Universe (tidak bisa dibatalkan lewat KRYNOS).`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/roblox-connect/places/${p.id}?universeId=${universeId}&isRoot=false`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(`Gagal: ${data.error}`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(p: Place) {
    setEditingId(p.id);
    setEditName(p.name);
  }

  async function saveEdit(p: Place) {
    if (!editName.trim()) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/roblox-connect/places/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Gagal: ${data.error}`);
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setEditBusy(false);
    }
  }

  async function archiveUniverse() {
    if (!confirm("Arsipkan Universe ini? Roblox tidak punya fitur hapus permanen — arsip akan menonaktifkan experience-nya (data tetap ada di sisi Roblox).")) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/roblox-connect/universes/${universeId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(`Gagal: ${data.error}`);
        return;
      }
      router.push("/third-party-apps/roblox");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/third-party-apps/roblox" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <FaArrowLeft size={12} /> Semua Universe
      </Link>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Place</h1>
        <button onClick={archiveUniverse} disabled={archiving} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-40">
          {archiving ? <FaSpinner className="animate-spin" size={11} /> : <FaArchive size={11} />} Arsipkan Universe
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">Universe ID {universeId}</p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-600/40 bg-red-600/10 text-red-400 p-3 text-sm flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-300">{places.length} Place</h2>
        <button onClick={() => setCreating((v) => !v)} className="text-xs flex items-center gap-1 text-gray-300 hover:text-white">
          <FaPlus size={11} /> Place baru
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama Place"
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30"
            />
            <button onClick={createPlace} disabled={createBusy || !newName.trim()} className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-40">
              {createBusy ? <FaSpinner className="animate-spin" /> : "Buat"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Place baru pakai template baseplate default Roblox.</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <FaSpinner className="animate-spin" /> Memuat...
        </div>
      ) : (
        <div className="space-y-2">
          {places.map((p) =>
            editingId === p.id ? (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30"
                  autoFocus
                />
                <button onClick={() => saveEdit(p)} disabled={editBusy || !editName.trim()} className="px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-40">
                  {editBusy ? <FaSpinner className="animate-spin" size={12} /> : <FaSave size={12} />}
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 px-1.5">
                  Batal
                </button>
              </div>
            ) : (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 hover:border-white/25 transition">
                <Link href={`/third-party-apps/roblox/${universeId}/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <FaFile size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {p.name} {p.isRootPlace && <span className="text-xs text-gray-500">(root)</span>}
                    </div>
                    <div className="text-xs text-gray-500">ID {p.id}</div>
                  </div>
                </Link>
                <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-white p-1.5 shrink-0" title="Edit nama">
                  <FaPen size={12} />
                </button>
                <button onClick={() => removePlace(p)} disabled={busyId === p.id} className="text-red-400 hover:text-red-300 p-1.5 disabled:opacity-40 shrink-0">
                  {busyId === p.id ? <FaSpinner className="animate-spin" size={13} /> : <FaTrash size={13} />}
                </button>
              </div>
            )
          )}
          {places.length === 0 && !error && <div className="text-sm text-gray-500 text-center py-8">Belum ada Place.</div>}
        </div>
      )}
    </div>
  );
}
