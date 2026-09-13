"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowLeft, FaPlus, FaMobileAlt, FaEllipsisV, FaTrash, FaPen } from "react-icons/fa";
import {
  PonselProject,
  listProjects,
  createProject,
  deleteProject,
  renameProject,
} from "@/lib/ponselDb";

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

export default function ProjectPonselListPage() {
  const [projects, setProjects] = useState<PonselProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setProjects(await listProjects());
    } catch (e: any) {
      setError(e.message || "IndexedDB gak tersedia di browser ini.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    const name = prompt("Nama project baru:");
    if (!name) return;
    await createProject(name);
    load();
  }

  async function onRename(id: string, oldName: string) {
    const name = prompt("Nama baru:", oldName);
    if (!name) return;
    await renameProject(id, name);
    setMenuFor(null);
    load();
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Hapus project "${name}"? Semua file di dalamnya ikut kehapus permanen (cuma ada di HP ini, gak ada backup server).`)) return;
    await deleteProject(id);
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
          <FaMobileAlt className="text-accent" /> Project Ponsel
        </h1>
      </header>

      <div className="px-4 mt-4">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Project di sini disimpan langsung di penyimpanan browser HP kamu
          (IndexedDB) — gak butuh GitHub, gak ke-upload ke server. Cocok buat
          coding cepat/offline. Karena cuma di device ini, hapus browser data
          / ganti HP = project ikut hilang, jadi rajin-rajin download ZIP
          buat backup.
        </p>

        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 bg-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm mb-5"
        >
          <FaPlus size={12} /> Project Baru
        </button>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 p-3 rounded-lg mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">
            Belum ada project. Bikin yang pertama yuk!
          </p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="relative flex items-center bg-panel border border-border rounded-xl px-3 py-3"
              >
                <Link href={`/project-ponsel/${p.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Diubah {timeAgo(p.updatedAt)}</p>
                </Link>
                <button
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                  className="p-2 text-gray-500 hover:text-gray-200"
                >
                  <FaEllipsisV size={13} />
                </button>

                {menuFor === p.id && (
                  <div className="absolute right-2 top-11 z-20 w-40 bg-panel border border-border rounded-lg shadow-xl overflow-hidden">
                    <button
                      onClick={() => onRename(p.id, p.name)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5"
                    >
                      <FaPen size={11} /> Ganti Nama
                    </button>
                    <button
                      onClick={() => onDelete(p.id, p.name)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-white/5"
                    >
                      <FaTrash size={11} /> Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
