"use client";

import { useEffect, useState } from "react";
import { FaDatabase, FaPlus, FaTrash, FaPlay, FaTimes } from "react-icons/fa";

export default function DbConnectionsPanel() {
  const [connections, setConnections] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [connStr, setConnStr] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [activeConn, setActiveConn] = useState<any>(null);

  async function load() {
    const res = await fetch("/api/owner/db-connections");
    if (res.ok) setConnections(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function addConnection() {
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/owner/db-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, connectionString: connStr }),
      });
      if (res.ok) {
        setName("");
        setConnStr("");
        setShowAdd(false);
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setAddError(d.error || "Gagal menambah koneksi");
      }
    } catch (e: any) {
      setAddError(e?.message || "Gagal terhubung. Cek koneksi internet.");
    } finally {
      setAdding(false);
    }
  }

  async function removeConnection(id: string) {
    if (!confirm("Hapus koneksi database ini dari KRYNOS? (database aslinya gak ikut kehapus)")) return;
    const res = await fetch(`/api/owner/db-connections/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FaDatabase className="text-accent" /> Database Tambahan
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs bg-accent px-3 py-1.5 rounded-lg font-medium"
        >
          <FaPlus size={10} /> Tambah
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Nambah database Postgres/Supabase lain buat penyimpanan tambahan.
        Ini alat kelola manual (buat kamu jalanin SQL sendiri) — fitur
        KRYNOS lain (Komunitas, Plus, dll) TETAP pakai database utama,
        gak otomatis pindah ke sini.
      </p>

      {connections.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">Belum ada database tambahan.</p>
      )}

      <div className="space-y-2 mb-6">
        {connections.map((c) => (
          <div key={c.id} className="bg-panel border border-border rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.name}</p>
              <p className="text-[11px] text-gray-500 truncate font-mono">{c.connection_string}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveConn(c)}
                className="flex items-center gap-1.5 text-xs bg-accent/20 text-accent px-2.5 py-1.5 rounded-lg"
              >
                <FaPlay size={9} /> SQL Editor
              </button>
              <button onClick={() => removeConnection(c.id)} className="text-gray-500 hover:text-red-400">
                <FaTrash size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Tambah Database</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400">
                <FaTimes size={16} />
              </button>
            </div>

            <label className="text-xs text-gray-400">Nama (buat kamu inget aja)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="misal: Supabase Cadangan 1"
              className="w-full mt-1 mb-3 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />

            <label className="text-xs text-gray-400">Connection String (Postgres)</label>
            <input
              value={connStr}
              onChange={(e) => setConnStr(e.target.value)}
              placeholder="postgres://user:pass@host:6543/postgres"
              className="w-full mt-1 mb-2 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent font-mono"
            />
            <p className="text-[11px] text-gray-500 mb-4">
              Ambil dari Supabase → Project Settings → Database → Connection
              string → mode <b>Transaction</b> (port 6543), bukan Direct.
            </p>

            {addError && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg mb-3">{addError}</p>
            )}

            <button
              onClick={addConnection}
              disabled={adding || !name.trim() || !connStr.trim()}
              className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {adding ? "Menguji koneksi..." : "Tes & Simpan"}
            </button>
          </div>
        </div>
      )}

      {activeConn && (
        <SqlEditorModal connection={activeConn} onClose={() => setActiveConn(null)} />
      )}
    </div>
  );
}

function SqlEditorModal({ connection, onClose }: { connection: any; onClose: () => void }) {
  const [sql, setSql] = useState("select * from information_schema.tables where table_schema = 'public' limit 20;");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/owner/db-connections/${connection.id}/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const d = await res.json();
      if (res.ok) setResult(d);
      else setError(d.error || "Query gagal");
    } catch (e: any) {
      setError(e?.message || "Gagal terhubung. Cek koneksi internet.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-3">
      <div className="w-full max-w-3xl h-[85dvh] bg-panel border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">SQL Editor</h3>
            <p className="text-[11px] text-gray-500 truncate">{connection.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400">
            <FaTimes size={16} />
          </button>
        </div>

        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          className="h-40 shrink-0 bg-[#1e1e1e] text-gray-200 font-mono text-[13px] p-3 outline-none resize-none border-b border-border"
        />

        <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            {result ? `${result.rowCount} baris · ${result.command}` : "Belum dijalanin"}
          </p>
          <button
            onClick={run}
            disabled={running || !sql.trim()}
            className="flex items-center gap-1.5 bg-accent px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            <FaPlay size={9} />
            {running ? "Menjalankan..." : "Run"}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-lg font-mono whitespace-pre-wrap">
              {error}
            </p>
          )}

          {result && result.rows.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {result.fields.map((f: string) => (
                    <th key={f} className="text-left px-2 py-1.5 text-gray-400 font-medium whitespace-nowrap">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    {result.fields.map((f: string) => (
                      <td key={f} className="px-2 py-1.5 whitespace-nowrap font-mono">
                        {row[f] === null ? (
                          <span className="text-gray-600">null</span>
                        ) : (
                          String(row[f])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result && result.rows.length === 0 && !error && (
            <p className="text-xs text-gray-500">Query berhasil, gak ada baris hasil.</p>
          )}
        </div>
      </div>
    </div>
  );
}
