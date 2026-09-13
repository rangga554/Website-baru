"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowLeft, FaSpinner, FaExclamationTriangle, FaPlus, FaCube, FaSignOutAlt, FaKey, FaPen, FaSave, FaShieldAlt, FaCheckCircle } from "react-icons/fa";

type Universe = {
  id: number;
  name: string;
  description?: string;
  rootPlace?: { id: number };
  placeVisits?: number;
};

export default function RobloxUniversesPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cookieInput, setCookieInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeyEditValue, setApiKeyEditValue] = useState("");
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyMsg, setApiKeyMsg] = useState<string | null>(null);

  const [accessCheck, setAccessCheck] = useState<Record<number, "checking" | "ok" | "fail">>({});
  const [accessCheckMsg, setAccessCheckMsg] = useState<Record<number, string>>({});

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/roblox-connect/status").then((r) => r.json());
    setConnected(!!res.connected);
    setAccount(res.account || null);
    setUniverses(res.universes || []);
    setHasApiKey(!!res.hasApiKey);
    if (res.error) setError(res.error);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function connect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/roblox-connect/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cookie: cookieInput, apiKey: apiKeyInput.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error);
        return;
      }
      setCookieInput("");
      setApiKeyInput("");
      await load();
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Putuskan koneksi akun Roblox? Cookie yang tersimpan akan dihapus.")) return;
    await fetch("/api/roblox-connect/disconnect", { method: "POST" });
    await load();
  }

  async function saveApiKey() {
    setApiKeyBusy(true);
    setApiKeyMsg(null);
    try {
      const res = await fetch("/api/roblox-connect/apikey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyEditValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiKeyMsg(`Gagal: ${data.error}`);
        return;
      }
      setApiKeyEditing(false);
      setAccessCheck({});
      setAccessCheckMsg({});
      await load();
    } finally {
      setApiKeyBusy(false);
    }
  }

  async function checkAccess(universeId: number) {
    setAccessCheck((prev) => ({ ...prev, [universeId]: "checking" }));
    const res = await fetch(`/api/roblox-connect/apikey/check?universeId=${universeId}`).then((r) => r.json());
    setAccessCheck((prev) => ({ ...prev, [universeId]: res.ok ? "ok" : "fail" }));
    if (!res.ok) setAccessCheckMsg((prev) => ({ ...prev, [universeId]: res.error || "Gagal" }));
  }

  async function createUniverse() {
    if (!newName.trim()) return;
    setCreateBusy(true);
    try {
      const res = await fetch("/api/roblox-connect/universes", {
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

  function startEdit(u: Universe) {
    setEditingId(u.id);
    setEditName(u.name);
  }

  async function saveEdit(u: Universe) {
    if (!editName.trim() || !u.rootPlace?.id) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/roblox-connect/universes/${u.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), rootPlaceId: u.rootPlace.id }),
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/third-party-apps" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <FaArrowLeft size={12} /> Aplikasi Pihak Ketiga
      </Link>
      <h1 className="text-lg font-semibold mb-1">Roblox</h1>
      <p className="text-sm text-gray-400 mb-6">
        Hubungkan akun Roblox kamu sendiri pakai cookie <code className="text-xs bg-white/5 px-1 py-0.5 rounded">.ROBLOSECURITY</code>.
        Endpoint yang dipakai bukan API resmi publik Roblox — bisa berubah sewaktu-waktu.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <FaSpinner className="animate-spin" /> Memuat...
        </div>
      ) : !connected ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium">
            <FaKey size={13} /> Tempel cookie .ROBLOSECURITY
          </div>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Ambil dari DevTools browser (Application → Cookies → roblox.com) saat login di akun Roblox kamu. Cookie ini setara password akun — cuma tempel di sini kalau kamu percaya perangkat & koneksinya, dan JANGAN dibagikan ke siapapun.
          </p>
          <textarea
            value={cookieInput}
            onChange={(e) => setCookieInput(e.target.value)}
            placeholder="_|WARNING:-DO-NOT-SHARE-THIS...  atau  .ROBLOSECURITY=_|WARNING..."
            className="w-full h-24 text-xs bg-black/30 border border-white/10 rounded-lg p-2 font-mono resize-none focus:outline-none focus:border-white/30"
          />
          <div className="mt-3 flex items-center gap-2 mb-1.5 text-xs font-medium text-gray-300">
            <FaShieldAlt size={11} /> API Key Open Cloud (opsional)
          </div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            Cuma dibutuhin buat operasi yang wajib pakai jalur resmi Roblox. Bisa dilewatin dulu, isi belakangan juga bisa.
          </p>
          <input
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="API Key dari Creator Dashboard (opsional)"
            className="w-full text-xs bg-black/30 border border-white/10 rounded-lg p-2 font-mono focus:outline-none focus:border-white/30"
          />
          {connectError && (
            <div className="mt-2 text-xs text-red-400 flex items-start gap-1.5">
              <FaExclamationTriangle className="mt-0.5 shrink-0" /> {connectError}
            </div>
          )}
          <button
            onClick={connect}
            disabled={connecting || !cookieInput.trim()}
            className="mt-3 w-full py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {connecting ? <FaSpinner className="animate-spin" /> : null} Hubungkan
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 mb-4">
            <div className="text-sm">
              Terhubung sebagai <span className="font-medium">{account?.name}</span>
            </div>
            <button onClick={disconnect} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              <FaSignOutAlt size={12} /> Putuskan
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <FaShieldAlt size={11} /> API Key Open Cloud {hasApiKey ? <span className="text-green-400">(tersimpan)</span> : <span className="text-gray-500">(belum diisi)</span>}
              </div>
              <button
                onClick={() => {
                  setApiKeyEditing((v) => !v);
                  setApiKeyEditValue("");
                  setApiKeyMsg(null);
                }}
                className="text-xs text-gray-400 hover:text-white"
              >
                {hasApiKey ? "Ganti" : "Isi"}
              </button>
            </div>
            {apiKeyEditing && (
              <div className="mt-2">
                <input
                  value={apiKeyEditValue}
                  onChange={(e) => setApiKeyEditValue(e.target.value)}
                  placeholder="API Key dari Creator Dashboard"
                  className="w-full text-xs bg-black/30 border border-white/10 rounded-lg p-2 font-mono focus:outline-none focus:border-white/30"
                  autoFocus
                />
                {apiKeyMsg && <div className="mt-1.5 text-xs text-red-400">{apiKeyMsg}</div>}
                <button
                  onClick={saveApiKey}
                  disabled={apiKeyBusy || !apiKeyEditValue.trim()}
                  className="mt-2 w-full py-1.5 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {apiKeyBusy ? <FaSpinner className="animate-spin" size={11} /> : null} Simpan API Key
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-600/40 bg-red-600/10 text-red-400 p-3 text-sm flex items-start gap-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">Universe kamu ({universes.length})</h2>
            <button onClick={() => setCreating((v) => !v)} className="text-xs flex items-center gap-1 text-gray-300 hover:text-white">
              <FaPlus size={11} /> Universe baru
            </button>
          </div>

          {creating && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] p-3 flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama Universe"
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30"
              />
              <button
                onClick={createUniverse}
                disabled={createBusy || !newName.trim()}
                className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-40"
              >
                {createBusy ? <FaSpinner className="animate-spin" /> : "Buat"}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {universes.map((u) => (
              <div key={u.id} className="rounded-lg border border-white/10 bg-white/[0.02] hover:border-white/25 transition overflow-hidden">
                {editingId === u.id ? (
                  <div className="flex items-center gap-2 p-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-white/30"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(u)} disabled={editBusy || !editName.trim()} className="px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-40">
                      {editBusy ? <FaSpinner className="animate-spin" size={12} /> : <FaSave size={12} />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 px-1.5">
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    <Link href={`/third-party-apps/roblox/${u.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <FaCube size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-gray-500">ID {u.id}</div>
                      </div>
                    </Link>
                    {hasApiKey && (
                      <button
                        onClick={() => checkAccess(u.id)}
                        title={accessCheckMsg[u.id] || "Cek akses API Key ke Universe ini"}
                        className="shrink-0 text-xs px-2 py-1 rounded-full border border-white/10 flex items-center gap-1"
                      >
                        {accessCheck[u.id] === "checking" ? (
                          <FaSpinner className="animate-spin" size={10} />
                        ) : accessCheck[u.id] === "ok" ? (
                          <FaCheckCircle className="text-green-400" size={10} />
                        ) : accessCheck[u.id] === "fail" ? (
                          <FaExclamationTriangle className="text-yellow-500" size={10} />
                        ) : (
                          <FaShieldAlt className="text-gray-500" size={10} />
                        )}
                        <span className="text-gray-400">API</span>
                      </button>
                    )}
                    <button onClick={() => startEdit(u)} className="text-gray-400 hover:text-white p-1.5 shrink-0" title="Edit nama">
                      <FaPen size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {universes.length === 0 && !error && <div className="text-sm text-gray-500 text-center py-8">Belum ada Universe.</div>}
          </div>
        </>
      )}
    </div>
  );
}
