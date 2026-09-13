"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FaUsers, FaImage, FaPaperPlane, FaChartBar, FaClock, FaPaperclip, FaFileArchive, FaDownload, FaTrash, FaMusic,
} from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import { downloadFromUrl } from "@/lib/nativeDownload";
import { useRole } from "@/lib/useRole";
import { getIdentity } from "@/lib/identity";
import PollCard from "@/components/PollCard";
import CreatePollModal from "@/components/CreatePollModal";
import RoleBadge from "@/components/RoleBadge";

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatResetCountdown(nextResetAt: string): string {
  const ms = new Date(nextResetAt).getTime() - Date.now();
  if (ms <= 0) return "sebentar lagi";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}d`;
}

export default function KomunitasPage() {
  const { data: session } = useSession();
  const identity = getIdentity(session);
  const login = identity?.id;
  const owner = useRole(login).isPrivileged;

  const [messages, setMessages] = useState<any[]>([]);
  const [nextResetAt, setNextResetAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showPollModal, setShowPollModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [now, setNow] = useState(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anyFileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/community/messages");
    if (res.ok) {
      const d = await res.json();
      setMessages(d.messages);
      setNextResetAt(d.nextResetAt);
    }
    setLoading(false);
  }

  async function deleteMessage(id: string) {
    if (!confirm("Hapus pesan ini?")) return;
    const res = await fetch(`/api/community/messages/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  useEffect(() => {
    load();
  }, []);

  useLivePolling(load, 4000, true);

  // Buat countdown "reset dalam ..." di header, update tiap detik.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendText() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "text", content: trimmed }),
      });
      if (res.ok) {
        setText("");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Gagal mengirim pesan");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengirim pesan. Cek koneksi internet.");
    } finally {
      setSending(false);
    }
  }

  function pickImage() {
    fileInputRef.current?.click();
  }

  function pickAnyFile() {
    anyFileInputRef.current?.click();
  }

  function pickMusic() {
    musicInputRef.current?.click();
  }

  async function handleMusicSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setError("File yang dipilih bukan musik/audio");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Ukuran musik maksimal 3MB buat dikirim di Komunitas");
      return;
    }

    setUploading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/community/upload-music", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result, fileName: file.name }),
        });
        if (res.ok) {
          load();
        } else {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Gagal upload musik");
        }
      } catch (err: any) {
        setError(err?.message || "Gagal upload musik. Cek koneksi internet.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleAnyFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError("Ukuran file maksimal 3MB buat dikirim di Komunitas");
      return;
    }

    setUploading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/community/upload-file", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result, fileName: file.name }),
        });
        if (res.ok) {
          load();
        } else {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Gagal upload file");
        }
      } catch (err: any) {
        setError(err?.message || "Gagal upload file. Cek koneksi internet.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5MB");
      return;
    }

    setUploading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/community/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        if (res.ok) {
          load();
        } else {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "Gagal upload gambar");
        }
      } catch (err: any) {
        setError(err?.message || "Gagal upload gambar. Cek koneksi internet.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <FaUsers className="text-accent" /> Komunitas
          </h1>
          <Link href="/dashboard" className="text-xs text-gray-400 underline">
            Kembali
          </Link>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-gray-500">Maks. 50 pesan/orang per sesi</p>
          {nextResetAt && (
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <FaClock size={9} /> Reset dalam {formatResetCountdown(nextResetAt)}
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <p className="text-sm text-gray-500 text-center">Memuat chat...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center mt-10">
            Belum ada pesan. Mulai obrolan pertama di sesi ini!
          </p>
        )}

        {messages.map((m) => {
          const mine = m.login === login;
          if (m.type === "poll" && m.poll) {
            return (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <PollCard poll={m.poll} onVoted={load} />
                {owner && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className="text-[10px] text-gray-500 hover:text-red-400 flex items-center gap-1"
                  >
                    <FaTrash size={9} /> Hapus polling
                  </button>
                )}
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <img src={m.avatar_url} className="w-7 h-7 rounded-full shrink-0 mt-1" />
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <p className="text-[10px] text-gray-500 mb-0.5 px-1 flex items-center gap-1.5">
                  {m.login}
                  <RoleBadge login={m.login} />
                  {owner && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="text-gray-600 hover:text-red-400"
                      title="Hapus pesan"
                    >
                      <FaTrash size={9} />
                    </button>
                  )}
                </p>
                {m.type === "image" ? (
                  <img
                    src={m.content}
                    className="rounded-xl max-h-64 border border-border"
                    loading="lazy"
                  />
                ) : m.type === "audio" ? (
                  <div
                    className={`rounded-xl px-3 py-2.5 text-sm w-64 max-w-full ${
                      mine ? "bg-accent/20" : "bg-panel border border-border"
                    }`}
                  >
                    <p className="flex items-center gap-1.5 truncate font-medium mb-1.5">
                      <FaMusic className="text-accent shrink-0" size={12} />
                      <span className="truncate">{m.file_name || "Musik"}</span>
                    </p>
                    <audio controls preload="none" src={m.content} className="w-full h-9" />
                    {m.file_size ? (
                      <p className="text-[10px] text-gray-500 mt-1">{formatFileSize(m.file_size)}</p>
                    ) : null}
                  </div>
                ) : m.type === "file" ? (
                  <button
                    onClick={() => downloadFromUrl(m.content, m.file_name || "file")}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left ${
                      mine ? "bg-accent/20" : "bg-panel border border-border"
                    }`}
                  >
                    <FaFileArchive className="text-accent shrink-0" size={18} />
                    <div className="min-w-0">
                      <p className="truncate max-w-[180px] font-medium">{m.file_name || "File"}</p>
                      <p className="text-[10px] text-gray-500">
                        {formatFileSize(m.file_size)} · Tap buat download
                      </p>
                    </div>
                    <FaDownload className="text-gray-500 shrink-0 ml-1" size={12} />
                  </button>
                ) : (
                  <div
                    className={`rounded-xl px-3 py-2 text-sm break-words ${
                      mine ? "bg-accent/20" : "bg-panel border border-border"
                    }`}
                  >
                    <Linkified text={m.content} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 px-4 py-2 mx-4 rounded-lg mb-2">
          {error}
        </p>
      )}

      <div className="border-t border-border p-3 flex items-center gap-2 shrink-0">
        {owner && (
          <button
            onClick={() => setShowPollModal(true)}
            title="Buat Global Polling"
            className="shrink-0 p-2.5 rounded-lg bg-panel border border-border text-yellow-400"
          >
            <FaChartBar size={15} />
          </button>
        )}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowAttachMenu((v) => !v)}
            disabled={uploading}
            title="Lampirkan gambar atau file"
            className="p-2.5 rounded-lg bg-panel border border-border text-gray-300 disabled:opacity-50"
          >
            <FaPaperclip size={15} />
          </button>
          {showAttachMenu && (
            <>
              {/* backdrop transparan buat nutup menu kalau tap di luar */}
              <div className="fixed inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
              <div className="absolute bottom-full left-0 mb-2 z-20 w-44 rounded-xl border border-border bg-panel shadow-xl overflow-hidden">
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    pickImage();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 text-left"
                >
                  <FaImage size={13} className="text-accent" /> Gambar
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    pickMusic();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 text-left border-t border-border"
                >
                  <FaMusic size={13} className="text-accent" /> Musik
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false);
                    pickAnyFile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 text-left border-t border-border"
                >
                  <FaFileArchive size={13} className="text-accent" /> File (ZIP, PDF, dll)
                </button>
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelected}
        />
        <input
          ref={anyFileInputRef}
          type="file"
          className="hidden"
          onChange={handleAnyFileSelected}
        />
        <input
          ref={musicInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleMusicSelected}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder={uploading ? "Mengupload..." : "Tulis pesan..."}
          className="flex-1 min-w-0 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={sendText}
          disabled={sending || !text.trim()}
          title="Kirim"
          className="shrink-0 p-2.5 rounded-lg bg-accent disabled:opacity-50"
        >
          <FaPaperPlane size={14} />
        </button>
      </div>

      {showPollModal && (
        <CreatePollModal onClose={() => setShowPollModal(false)} onCreated={load} />
      )}
    </main>
  );
}
