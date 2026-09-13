"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { downloadBlob } from "@/lib/nativeDownload";
import {
  FaArrowLeft,
  FaDownload,
  FaTrash,
  FaPen,
  FaComments,
  FaFile,
  FaSave,
  FaEye,
  FaCode,
  FaPaperPlane,
  FaRobot,
} from "react-icons/fa";
import {
  AiProject,
  AiProjectFile,
  AiProjectRef,
  getProject,
  listProjectFiles,
  renameProject,
  saveProjectFile,
  deleteProject,
  addMessage,
  listMessages,
  upsertProjectFiles,
} from "@/lib/aiDb";

function buildPreviewHtml(entryContent: string, files: AiProjectFile[]): string {
  let html = entryContent;
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  // Inline <link rel="stylesheet" href="local.css"> -> <style>...</style>
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"'/][^"']*)["'][^>]*>/gi, (match, href) => {
    const content = byPath.get(href.replace(/^\.?\//, ""));
    return content !== undefined ? `<style>\n${content}\n</style>` : match;
  });

  // Inline <script src="local.js"></script> -> <script>...</script>
  html = html.replace(/<script[^>]+src=["']([^"'/][^"']*)["'][^>]*><\/script>/gi, (match, src) => {
    const content = byPath.get(src.replace(/^\.?\//, ""));
    return content !== undefined ? `<script>\n${content}\n</script>` : match;
  });

  return html;
}

export default function AiProjectWorkspacePage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<AiProject | null>(null);
  const [files, setFiles] = useState<AiProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"preview" | "files">("preview");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editSending, setEditSending] = useState(false);
  const [editNote, setEditNote] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    try {
      const p = await getProject(params.projectId);
      const f = await listProjectFiles(params.projectId);
      setProject(p);
      setFiles(f);
    } catch (e: any) {
      setError(e.message || "Gagal memuat project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.projectId]);

  const entryFile = useMemo(() => files.find((f) => f.path === "index.html") || files.find((f) => f.path.endsWith(".html")), [files]);
  const previewHtml = useMemo(() => (entryFile ? buildPreviewHtml(entryFile.content, files) : null), [entryFile, files]);

  // Minta AI ubah project ini langsung dari halaman workspace-nya — jadi
  // user bisa berkali-kali nyuruh AI ngedit file yang SAMA (bukan cuma bisa
  // sekali generate terus mentok), tanpa harus balik ke thread chat awal.
  async function onRequestEdit() {
    const text = editPrompt.trim();
    if (!text || editSending || !project) return;
    setEditPrompt("");
    setEditSending(true);
    setEditNote(null);

    try {
      const history = (await listMessages(project.conversationId))
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      await addMessage(project.conversationId, "user", text);

      const res = await fetch("/api/mastercode-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          message: text,
          existingProject: { name: project.name, files: files.map((f) => ({ path: f.path, content: f.content })) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal minta AI ngedit project");

      let projectRef: AiProjectRef | null = null;
      if (data.project) {
        await upsertProjectFiles(project.id, data.project.files);
        const allFiles = await listProjectFiles(project.id);
        projectRef = {
          id: project.id,
          name: data.project.name,
          fileCount: allFiles.length,
          changedPaths: data.project.files.map((f: any) => f.path),
        };
        setEditNote({ type: "ok", text: `Diperbarui: ${data.project.files.map((f: any) => f.path).join(", ")}` });
      } else {
        setEditNote({ type: "ok", text: data.reply || "AI membalas tapi gak ada perubahan file." });
      }

      await addMessage(project.conversationId, "assistant", data.reply || "(gak ada balasan)", projectRef);
      await load();
    } catch (e: any) {
      setEditNote({ type: "err", text: e.message || "Gagal minta AI ngedit project." });
    } finally {
      setEditSending(false);
    }
  }

  function openFile(f: AiProjectFile) {
    setActiveFile(f.path);
    setEditContent(f.content);
  }

  async function saveFile() {
    if (!activeFile || !project) return;
    setSaving(true);
    try {
      await saveProjectFile(project.id, activeFile, editContent);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onRename() {
    if (!project) return;
    const name = prompt("Nama project baru:", project.name);
    if (!name) return;
    await renameProject(project.id, name);
    load();
  }

  async function onDelete() {
    if (!project) return;
    if (!confirm(`Hapus project "${project.name}"? Semua file ikut kehapus permanen.`)) return;
    await deleteProject(project.id);
    router.push("/ai");
  }

  async function onDownloadZip() {
    if (!project) return;
    const zip = new JSZip();
    files.forEach((f) => zip.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const fileName = `${project.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "project"}.zip`;
    await downloadBlob(blob, fileName);
  }

  if (loading) {
    return <main className="min-h-dvh bg-base flex items-center justify-center text-sm text-gray-500">Memuat...</main>;
  }

  if (!project) {
    return (
      <main className="min-h-dvh bg-base flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-gray-400">Project gak ketemu di device ini.</p>
        <Link href="/ai" className="text-accent text-sm">
          Balik ke KRYNOS AI
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/ai")} className="p-1 text-gray-400">
          <FaArrowLeft />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-sm truncate">{project.name}</h1>
          <p className="text-[11px] text-gray-500">{files.length} file</p>
        </div>
        <button onClick={onRename} className="p-2 text-gray-400 hover:text-gray-200">
          <FaPen size={13} />
        </button>
        <button onClick={onDelete} className="p-2 text-red-400/80 hover:text-red-400">
          <FaTrash size={13} />
        </button>
      </header>

      <div className="px-4 pt-3 flex gap-2">
        <Link
          href={`/ai/${project.conversationId}`}
          className="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-lg px-3 py-1.5 hover:border-accent"
        >
          <FaComments size={11} /> Lanjut Ngobrol
        </Link>
        <button
          onClick={() => setView(view === "preview" ? "files" : "preview")}
          className="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-lg px-3 py-1.5 hover:border-accent ml-auto"
        >
          {view === "preview" ? (
            <>
              <FaCode size={11} /> Lihat File
            </>
          ) : (
            <>
              <FaEye size={11} /> Preview
            </>
          )}
        </button>
        <button onClick={onDownloadZip} className="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-lg px-3 py-1.5 hover:border-accent">
          <FaDownload size={11} /> ZIP
        </button>
      </div>

      {error && <p className="mx-4 mt-3 text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg">{error}</p>}

      <div className="mx-4 mt-3 bg-panel border border-border rounded-xl p-3.5">
        <p className="text-xs font-medium flex items-center gap-1.5 mb-2">
          <FaRobot size={12} className="text-accent" /> Minta AI Edit Project Ini
        </p>
        <div className="flex items-end gap-2">
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onRequestEdit();
              }
            }}
            placeholder='Misal: "Ganti warna tombol jadi hijau" atau "Tambahin section testimoni"'
            rows={1}
            className="flex-1 bg-base border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent resize-none max-h-24"
          />
          <button
            onClick={onRequestEdit}
            disabled={editSending || !editPrompt.trim()}
            className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0 active:scale-[0.95] disabled:opacity-40"
          >
            <FaPaperPlane size={12} />
          </button>
        </div>
        {editSending && <p className="text-[11px] text-gray-400 mt-2">Menyiapkan code...</p>}
        {editNote && !editSending && (
          <p className={`text-[11px] mt-2 ${editNote.type === "ok" ? "text-green-400" : "text-red-400"}`}>{editNote.text}</p>
        )}
        <p className="text-[10px] text-gray-500 mt-2">
          Bisa diulang berkali-kali — AI ngedit file yang udah ada, bukan bikin project baru. Perubahan juga kesimpen
          di riwayat <Link href={`/ai/${project.conversationId}`} className="text-accent">percakapannya</Link>.
        </p>
      </div>

      <div className="flex-1 px-4 mt-3 mb-4">
        {view === "preview" ? (
          previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              className="w-full h-[60vh] rounded-xl border border-border bg-white"
              title="Preview"
            />
          ) : (
            <p className="text-sm text-gray-500 text-center py-10">Belum ada file HTML buat di-preview.</p>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {files.map((f) => (
                <button
                  key={f.id}
                  onClick={() => openFile(f)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs ${
                    activeFile === f.path ? "bg-accent/20 border border-accent/50" : "bg-panel border border-border hover:border-accent/40"
                  }`}
                >
                  <FaFile size={10} className="text-gray-400 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>
            <div>
              {activeFile ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    spellCheck={false}
                    className="w-full h-[52vh] bg-panel border border-border rounded-lg p-3 text-xs font-mono outline-none focus:border-accent resize-none"
                  />
                  <button
                    onClick={saveFile}
                    disabled={saving}
                    className="self-start flex items-center gap-1.5 bg-accent text-xs font-medium px-3.5 py-2 rounded-lg active:scale-[0.98] disabled:opacity-50"
                  >
                    <FaSave size={11} /> {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-10">Pilih file di sebelah kiri buat lihat/edit isinya.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
