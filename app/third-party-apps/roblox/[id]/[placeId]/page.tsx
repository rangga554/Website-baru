"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  FaArrowLeft,
  FaSpinner,
  FaExclamationTriangle,
  FaFolder,
  FaFileCode,
  FaChevronRight,
  FaChevronDown,
  FaPlus,
  FaTrash,
  FaSave,
  FaDownload,
  FaTimes,
} from "react-icons/fa";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type TreeNode = {
  referent: number;
  className: string;
  name: string;
  children: TreeNode[];
  isScript?: boolean;
};

export default function RobloxExplorerPage() {
  const params = useParams();
  const universeId = params.id as string;
  const placeId = params.placeId as string;

  const [services, setServices] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [editing, setEditing] = useState<TreeNode | null>(null);
  const [source, setSource] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionType, setVersionType] = useState<"Saved" | "Published">("Saved");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);

  const [creatingUnder, setCreatingUnder] = useState<TreeNode | null>(null);
  const [newClassName, setNewClassName] = useState<"Script" | "LocalScript" | "ModuleScript">("Script");
  const [newName, setNewName] = useState("Script");
  const [createBusy, setCreateBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    const res = await fetch(`/api/roblox-connect/places/${placeId}/explorer`).then((r) => r.json());
    if (res.error) {
      setError(res.error);
      if (res.debug) setDebugInfo(res.debug);
    } else {
      setServices(res.services || []);
      if ((res.services || []).length === 0 && (res.debugTopLevel || res.debugClassCount !== undefined || res.debug)) {
        setDebugInfo({ topLevel: res.debugTopLevel, classCount: res.debugClassCount, chunkInspect: res.debug });
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [placeId]);

  function toggle(ref: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  async function openScript(node: TreeNode) {
    setEditing(node);
    setSource("");
    setSaveMsg(null);
    setBackedUp(false);
    setVersionType("Saved");
    setSourceLoading(true);
    try {
      const res = await fetch(`/api/roblox-connect/places/${placeId}/script?ref=${node.referent}`).then((r) => r.json());
      if (res.error) {
        setSaveMsg(`Gagal baca: ${res.error}`);
        return;
      }
      setSource(res.source || "");
    } finally {
      setSourceLoading(false);
    }
  }

  async function downloadBackup() {
    window.open(`/api/roblox-connect/places/${placeId}/backup`, "_blank");
    setBackedUp(true);
  }

  async function saveScript() {
    if (!editing) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/roblox-connect/places/${placeId}/script`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ universeId: Number(universeId), ref: editing.referent, source, versionType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(`Gagal: ${data.error}`);
        return;
      }
      setSaveMsg(`Tersimpan sebagai ${data.versionType === "Published" ? "versi live (Published)" : "draft (Saved)"} — versi #${data.versionNumber}.`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteScript(node: TreeNode) {
    if (!confirm(`Hapus script "${node.name}"? Sebaiknya download backup dulu.`)) return;
    const res = await fetch(`/api/roblox-connect/places/${placeId}/script`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ universeId: Number(universeId), ref: node.referent, versionType: "Saved" }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal: ${data.error}`);
      return;
    }
    await load();
  }

  async function createScript() {
    if (!creatingUnder || !newName.trim()) return;
    setCreateBusy(true);
    try {
      const res = await fetch(`/api/roblox-connect/places/${placeId}/script`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          universeId: Number(universeId),
          parentReferent: creatingUnder.referent,
          className: newClassName,
          name: newName.trim(),
          source: "-- script baru dari KRYNOS\n",
          versionType: "Saved",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Gagal: ${data.error}`);
        return;
      }
      setCreatingUnder(null);
      setNewName("Script");
      await load();
    } finally {
      setCreateBusy(false);
    }
  }

  function renderNode(node: TreeNode, depth: number) {
    const isOpen = expanded.has(node.referent);
    const hasChildren = node.children.length > 0;
    return (
      <div key={node.referent}>
        <div className="flex items-center gap-1.5 py-1.5 rounded hover:bg-white/5 group" style={{ paddingLeft: depth * 16 }}>
          {hasChildren ? (
            <button onClick={() => toggle(node.referent)} className="text-gray-500 shrink-0">
              {isOpen ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />}
            </button>
          ) : (
            <span className="w-[9px] shrink-0" />
          )}
          {node.isScript ? <FaFileCode size={12} className="text-blue-400 shrink-0" /> : <FaFolder size={12} className="text-yellow-500 shrink-0" />}
          {node.isScript ? (
            <button onClick={() => openScript(node)} className="text-sm truncate text-left hover:underline">
              {node.name}
            </button>
          ) : (
            <span className="text-sm truncate text-gray-300">{node.name}</span>
          )}
          <span className="text-[10px] text-gray-600 shrink-0">{node.className}</span>
          <span className="flex-1" />
          {!node.isScript && (
            <button
              onClick={() => {
                setCreatingUnder(node);
                setExpanded((prev) => new Set(prev).add(node.referent));
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white shrink-0 px-1"
              title="Buat script di sini"
            >
              <FaPlus size={11} />
            </button>
          )}
          {node.isScript && (
            <button onClick={() => deleteScript(node)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 shrink-0 px-1" title="Hapus script">
              <FaTrash size={11} />
            </button>
          )}
        </div>
        {creatingUnder?.referent === node.referent && (
          <div className="flex items-center gap-1.5 py-1.5" style={{ paddingLeft: (depth + 1) * 16 }}>
            <select value={newClassName} onChange={(e) => setNewClassName(e.target.value as any)} className="bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs">
              <option value="Script">Script</option>
              <option value="LocalScript">LocalScript</option>
              <option value="ModuleScript">ModuleScript</option>
            </select>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-black/30 border border-white/10 rounded px-1.5 py-1 text-xs w-28"
            />
            <button onClick={createScript} disabled={createBusy} className="text-xs bg-white text-black px-2 py-1 rounded disabled:opacity-40">
              {createBusy ? <FaSpinner className="animate-spin" /> : "Buat"}
            </button>
            <button onClick={() => setCreatingUnder(null)} className="text-xs text-gray-400 px-1">
              Batal
            </button>
          </div>
        )}
        {isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href={`/third-party-apps/roblox/${universeId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
        <FaArrowLeft size={12} /> Semua Place
      </Link>
      <h1 className="text-lg font-semibold mb-1">Script Explorer</h1>
      <p className="text-sm text-gray-400 mb-4">Place ID {placeId}</p>

      <div className="mb-4 rounded-lg border border-yellow-600/30 bg-yellow-600/5 p-3 text-xs text-yellow-500/90 flex items-start gap-2">
        <FaExclamationTriangle className="mt-0.5 shrink-0" />
        <span>
          Fitur ini baca/tulis file place langsung (di luar API resmi Roblox). Edit source relatif aman, tapi buat/hapus script lebih eksperimental. Selalu{" "}
          <button onClick={downloadBackup} className="underline">
            download backup .rbxl
          </button>{" "}
          dulu sebelum ubah yang penting.
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-600/40 bg-red-600/10 text-red-400 p-3 text-sm flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <FaSpinner className="animate-spin" /> Mendownload & membaca file place...
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          {services.map((s) => renderNode(s, 0))}
          {services.length === 0 && !error && (
            <div className="text-sm text-gray-500 text-center py-8">
              Tidak ada ServerScriptService/StarterPlayerScripts/dll yang terdeteksi di place ini.
            </div>
          )}
        </div>
      )}

      {debugInfo && (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-xs text-gray-400 mb-2">
            Info diagnostik (copy-paste ini kalau mau dilaporkan) —
          </div>
          <pre className="text-[10px] text-gray-400 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111] w-full sm:max-w-2xl h-[85vh] sm:h-[80vh] rounded-t-2xl sm:rounded-2xl border border-white/10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <FaFileCode size={13} className="text-blue-400 shrink-0" />
                <span className="text-sm font-medium truncate">{editing.name}</span>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white shrink-0">
                <FaTimes size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {sourceLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400 gap-2">
                  <FaSpinner className="animate-spin" /> Memuat source...
                </div>
              ) : (
                <MonacoEditor
                  height="100%"
                  language="lua"
                  theme="vs-dark"
                  value={source}
                  onChange={(v) => setSource(v || "")}
                  options={{ fontSize: 13, minimap: { enabled: false } }}
                />
              )}
            </div>
            <div className="border-t border-white/10 p-3 space-y-2">
              {saveMsg && <div className="text-xs text-gray-300">{saveMsg}</div>}
              <div className="flex items-center gap-2">
                <button onClick={downloadBackup} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <FaDownload size={11} /> Backup dulu
                </button>
                <span className="flex-1" />
                <select value={versionType} onChange={(e) => setVersionType(e.target.value as any)} className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs">
                  <option value="Saved">Simpan sebagai draft (Saved)</option>
                  <option value="Published">Publish ke live game</option>
                </select>
                <button
                  onClick={saveScript}
                  disabled={saving || sourceLoading}
                  className="flex items-center gap-1.5 bg-white text-black text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  {saving ? <FaSpinner className="animate-spin" size={12} /> : <FaSave size={12} />} Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
