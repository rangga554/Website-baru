"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaLayerGroup, FaDownload, FaSpinner, FaTimes } from "react-icons/fa";

type TemplateItem = {
  id: string;
  title: string;
  created_at: string;
};

function GetModal({
  template,
  onClose,
  onDone,
}: {
  template: TemplateItem;
  onClose: () => void;
  onDone: (url: string) => void;
}) {
  const [repoName, setRepoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!repoName.trim()) return setError("Nama repo wajib diisi");

    setBusy(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/get`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newRepoName: repoName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat repo dari Template");
      onDone(data.url);
    } catch (e: any) {
      setError(e.message || "Gagal membuat repo dari Template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4">
      <div className="w-full sm:max-w-sm bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Ambil "{template.title}"</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <FaTimes size={14} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Repo baru bakal dibuat di akun GitHub kamu, isinya langsung siap pakai.
        </p>

        <input
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          placeholder="nama-repo-baru"
          autoFocus
          className="w-full bg-black/20 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-accent mb-2"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-accent text-black text-sm font-medium py-2.5 rounded-lg disabled:opacity-50 active:scale-[0.98] transition"
        >
          {busy ? (
            <>
              <FaSpinner className="animate-spin" size={13} /> Membuat repo...
            </>
          ) : (
            "Get"
          )}
        </button>
      </div>
    </div>
  );
}

export default function TemplatePage() {
  const { status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<TemplateItem | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat Template");
        setTemplates(data);
      } catch (e: any) {
        setError(e.message || "Gagal memuat Template");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaLayerGroup className="text-accent" /> Template
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-gray-500">Memuat...</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada Template tersedia.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-panel border border-border rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tpl.title}</p>
                  <p className="text-xs text-gray-500">Siap dipakai langsung</p>
                </div>
                <button
                  onClick={() => setActiveTemplate(tpl)}
                  className="shrink-0 flex items-center gap-1.5 bg-accent text-black text-xs font-medium px-3 py-2 rounded-md active:scale-[0.98] transition"
                >
                  <FaDownload size={11} /> Get
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTemplate && !resultUrl && (
        <GetModal
          template={activeTemplate}
          onClose={() => setActiveTemplate(null)}
          onDone={(url) => setResultUrl(url)}
        />
      )}

      {resultUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full sm:max-w-sm bg-panel border border-border rounded-2xl p-5 text-center">
            <p className="text-sm font-medium mb-4">Repo baru kamu udah siap 🎉</p>
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-accent text-black text-sm font-medium py-2.5 rounded-lg mb-2"
            >
              Buka Repo
            </a>
            <button
              onClick={() => {
                setResultUrl(null);
                setActiveTemplate(null);
              }}
              className="w-full text-xs text-gray-400 py-2"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
