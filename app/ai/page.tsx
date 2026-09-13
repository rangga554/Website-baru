"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaPlus,
  FaRobot,
  FaEllipsisV,
  FaTrash,
  FaPen,
  FaComments,
  FaFolderOpen,
} from "react-icons/fa";
import {
  AiConversation,
  AiProject,
  listConversations,
  listAllProjects,
  createConversation,
  renameConversation,
  deleteConversation,
} from "@/lib/aiDb";

function timeAgo(ts: number) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

export default function MastercodeAiHubPage() {
  const [tab, setTab] = useState<"chat" | "project">("chat");
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [projects, setProjects] = useState<AiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [convs, projs] = await Promise.all([listConversations(), listAllProjects()]);
      setConversations(convs);
      setProjects(projs);
    } catch (e: any) {
      setError(e.message || "IndexedDB gak tersedia di browser ini.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onNewChat() {
    setCreating(true);
    try {
      const conv = await createConversation();
      window.location.href = `/ai/${conv.id}`;
    } finally {
      setCreating(false);
    }
  }

  async function onRename(id: string, oldTitle: string) {
    const title = prompt("Judul percakapan baru:", oldTitle);
    if (!title) return;
    await renameConversation(id, title);
    setMenuFor(null);
    load();
  }

  async function onDelete(id: string, title: string) {
    if (!confirm(`Hapus percakapan "${title}"? Project yang nempel di percakapan ini (kalau ada) ikut kehapus permanen dari device ini.`)) return;
    await deleteConversation(id);
    setMenuFor(null);
    load();
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-accent flex items-center justify-center">
            <FaRobot size={12} />
          </span>
          KRYNOS <span className="text-accent">AI</span>
        </h1>
      </header>

      <div className="px-4 mt-4">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Ngobrol bebas kayak AI biasa, atau minta AI bikinin/lanjutin website. Semua percakapan & project
          tersimpan lokal di HP/browser ini (bukan di repository GitHub) — bisa langsung di-preview,
          dan di-download jadi ZIP kapan aja.
        </p>

        <button
          onClick={onNewChat}
          disabled={creating}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm mb-4 disabled:opacity-60"
        >
          <FaPlus size={12} /> Percakapan Baru
        </button>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              tab === "chat" ? "bg-accent border-accent text-white" : "bg-panel border-border text-gray-400"
            }`}
          >
            <FaComments size={11} /> Percakapan
          </button>
          <button
            onClick={() => setTab("project")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              tab === "project" ? "bg-accent border-accent text-white" : "bg-panel border-border text-gray-400"
            }`}
          >
            <FaFolderOpen size={11} /> Project
          </button>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/40 p-3 rounded-lg mb-4">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>
        ) : tab === "chat" ? (
          conversations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">Belum ada percakapan. Mulai yang pertama yuk!</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
                <div key={c.id} className="relative flex items-center bg-panel border border-border rounded-xl px-3 py-3">
                  <Link href={`/ai/${c.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Diubah {timeAgo(c.updatedAt)}
                      {c.projectId && <span className="ml-2 text-accent">• ada project</span>}
                    </p>
                  </Link>
                  <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} className="p-2 text-gray-500 hover:text-gray-200">
                    <FaEllipsisV size={13} />
                  </button>
                  {menuFor === c.id && (
                    <div className="absolute right-2 top-11 z-20 w-40 bg-panel border border-border rounded-lg shadow-xl overflow-hidden">
                      <button onClick={() => onRename(c.id, c.title)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5">
                        <FaPen size={11} /> Ganti Judul
                      </button>
                      <button onClick={() => onDelete(c.id, c.title)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-white/5">
                        <FaTrash size={11} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            Belum ada project. Minta KRYNOS AI bikinin website di sebuah percakapan.
          </p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/ai/project/${p.id}`}
                className="block bg-panel border border-border rounded-xl px-3 py-3 active:scale-[0.98] transition hover:border-accent"
              >
                <p className="text-sm font-medium truncate">{p.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Diubah {timeAgo(p.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
