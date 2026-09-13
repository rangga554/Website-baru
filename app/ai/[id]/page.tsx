"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaPaperPlane, FaRobot, FaFolderOpen, FaUser } from "react-icons/fa";
import {
  AiConversation,
  AiMessage,
  AiProjectRef,
  getConversation,
  listMessages,
  addMessage,
  renameConversation,
  getProject,
  createProject,
  upsertProjectFiles,
  listProjectFiles,
} from "@/lib/aiDb";

export default function MastercodeAiChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [conv, setConv] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preparingProject, setPreparingProject] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await getConversation(params.id);
        if (!c) {
          setError("Percakapan gak ketemu di device ini.");
          setLoading(false);
          return;
        }
        setConv(c);
        setMessages(await listMessages(params.id));
      } catch (e: any) {
        setError(e.message || "Gagal memuat percakapan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const BUILD_KEYWORDS = /\b(bikin|buat|buatin|generate|lanjutin|update|ubah|edit|tambahin|revisi)\b.*\b(website|web|halaman|landing|page|situs|project|aplikasi|app)\b|\b(website|web|halaman|landing page|situs)\b.*\b(bikin|buat|buatin)\b/i;

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !conv) return;
    setInput("");
    setSending(true);
    setError("");
    // Nebak dari kalimat user + status project percakapan ini: kalau
    // kelihatannya lagi minta bikin/lanjutin website, tampilin "Menyiapkan
    // code..." bukan indikator ngobrol biasa — biar gak salah kesan kayak
    // AI-nya nge-dump kode ke chat pas lagi proses.
    const likelyBuildingProject = !!conv.projectId || BUILD_KEYWORDS.test(text);
    setPreparingProject(likelyBuildingProject);

    try {
      const userMsg = await addMessage(conv.id, "user", text);
      setMessages((prev) => [...prev, userMsg]);

      // Judul otomatis dari pesan pertama, biar list percakapan gak "Percakapan Baru" mulu.
      if (conv.title === "Percakapan Baru" && messages.length === 0) {
        const autoTitle = text.slice(0, 48);
        await renameConversation(conv.id, autoTitle);
        setConv({ ...conv, title: autoTitle });
      }

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      let existingProject: { name: string; files: { path: string; content: string }[] } | null = null;
      if (conv.projectId) {
        const proj = await getProject(conv.projectId);
        const files = await listProjectFiles(conv.projectId);
        if (proj) existingProject = { name: proj.name, files: files.map((f) => ({ path: f.path, content: f.content })) };
      }

      const res = await fetch("/api/mastercode-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: text, existingProject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal dapetin balasan dari KRYNOS AI");

      let projectRef: AiProjectRef | null = null;
      if (data.project) {
        let projectId = conv.projectId;
        if (!projectId) {
          const newProject = await createProject(conv.id, data.project.name);
          projectId = newProject.id;
          setConv((prev) => (prev ? { ...prev, projectId } : prev));
        }
        await upsertProjectFiles(projectId!, data.project.files);
        const allFiles = await listProjectFiles(projectId!);
        projectRef = {
          id: projectId!,
          name: data.project.name,
          fileCount: allFiles.length,
          changedPaths: data.project.files.map((f: any) => f.path),
        };
      }

      const assistantMsg = await addMessage(conv.id, "assistant", data.reply || "(gak ada balasan)", projectRef);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan.");
    } finally {
      setSending(false);
      setPreparingProject(false);
    }
  }

  if (loading) {
    return <main className="min-h-dvh bg-base flex items-center justify-center text-sm text-gray-500">Memuat...</main>;
  }

  if (!conv) {
    return (
      <main className="min-h-dvh bg-base flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-gray-400">{error || "Percakapan gak ketemu."}</p>
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
          <h1 className="font-bold text-sm truncate">{conv.title}</h1>
          <p className="text-[11px] text-gray-500">KRYNOS AI</p>
        </div>
        {conv.projectId && (
          <Link
            href={`/ai/project/${conv.projectId}`}
            className="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-lg px-2.5 py-1.5 shrink-0 hover:border-accent"
          >
            <FaFolderOpen size={11} className="text-accent" /> Project
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs text-gray-500 mt-10 leading-relaxed">
            Mulai ngobrol sama KRYNOS AI. Contoh: &quot;Bikinin landing page toko kopi&quot; atau tanya apa aja
            kayak asisten AI biasa.
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-violet-500 to-accent"
              }`}
            >
              {m.role === "user" ? <FaUser size={11} /> : <FaRobot size={11} />}
            </div>
            <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user" ? "bg-accent text-white rounded-tr-sm" : "bg-panel border border-border rounded-tl-sm"
                }`}
              >
                {m.content}
              </div>

              {m.projectRef && (
                <Link
                  href={`/ai/project/${m.projectRef.id}`}
                  className="w-full flex items-center gap-2.5 bg-gradient-to-br from-violet-600/20 to-accent/20 border border-accent/40 rounded-xl px-3 py-2.5 hover:border-accent transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-accent flex items-center justify-center shrink-0">
                    <FaFolderOpen size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{m.projectRef.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {m.projectRef.fileCount} file • {m.projectRef.changedPaths.length} diperbarui
                    </p>
                  </div>
                  <span className="text-[10px] text-accent shrink-0">Buka →</span>
                </Link>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-accent flex items-center justify-center shrink-0">
              <FaRobot size={11} />
            </div>
            <div className="flex items-center gap-2 bg-panel border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-gray-400">
              {preparingProject && <FaFolderOpen size={11} className="text-accent shrink-0" />}
              {preparingProject ? "Menyiapkan code..." : "KRYNOS AI sedang mikir..."}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="mx-4 mb-2 text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg">{error}</p>}

      <div className="sticky bottom-0 bg-base/95 backdrop-blur border-t border-border px-3 py-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Tulis pesan ke KRYNOS AI..."
          rows={1}
          className="flex-1 bg-panel border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent resize-none max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 active:scale-[0.95] transition disabled:opacity-40"
        >
          <FaPaperPlane size={13} />
        </button>
      </div>
    </main>
  );
}
