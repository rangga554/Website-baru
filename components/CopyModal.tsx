"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaPlus, FaFolderOpen, FaArrowLeft, FaLock, FaGlobe,
  FaSpinner, FaCloudUploadAlt,
} from "react-icons/fa";

type Repo = {
  name: string;
  owner: { login: string };
  full_name: string;
  private: boolean;
};

type Mode = "new" | "existing" | null;

async function readError(res: Response, fallback: string) {
  try {
    const d = await res.json();
    return d?.error || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export default function CopyModal({
  owner,
  repo,
  onClose,
}: {
  owner: string;
  repo: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // mode baru
  const [newName, setNewName] = useState(repo);
  const [isPrivate, setIsPrivate] = useState(false);

  // mode existing
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Repo | null>(null);

  useEffect(() => {
    if (mode === "existing" && repos === null) {
      setLoadingRepos(true);
      fetch("/api/github/repos")
        .then((r) => (r.ok ? r.json() : []))
        .then(setRepos)
        .finally(() => setLoadingRepos(false));
    }
  }, [mode, repos]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const body: any = { mode: mode === "existing" ? "existing" : "new" };
      if (mode === "existing") {
        if (!selected) {
          setError("Pilih repo tujuan dulu.");
          setLoading(false);
          return;
        }
        body.targetOwner = selected.owner.login;
        body.targetRepo = selected.name;
      } else {
        body.repoName = newName.trim();
        body.isPrivate = isPrivate;
      }

      const res = await fetch(`/api/github/repo/${owner}/${repo}/copy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setError(await readError(res, "Gagal menyalin repository"));
        setLoading(false);
        return;
      }

      const data = await res.json();
      router.push(`/editor/${data.owner}/${data.repo}`);
    } catch (e: any) {
      setError(e?.message || "Gagal menyalin repository. Cek koneksi internet.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[85dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1">Copy Repository</h2>
        <p className="text-xs text-gray-400 mb-4">
          Menyalin <span className="text-gray-300">{owner}/{repo}</span> jadi repo milik kamu
          sendiri sepenuhnya — bukan fork, jadi bebas mau public atau private.
        </p>

        {error && (
          <p className="text-sm text-red-400 mb-3 bg-red-950/40 p-2 rounded-lg">{error}</p>
        )}

        {/* --- Pilih mode --- */}
        {mode === null && (
          <div className="space-y-2.5">
            <button
              onClick={() => setMode("new")}
              className="w-full flex items-center gap-3 bg-base border border-border rounded-xl px-4 py-3 text-left active:scale-[0.98] hover:border-accent"
            >
              <FaPlus className="text-accent shrink-0" size={14} />
              <div>
                <p className="text-sm font-medium">Buat repository baru</p>
                <p className="text-xs text-gray-500">Bisa langsung diatur private</p>
              </div>
            </button>
            <button
              onClick={() => setMode("existing")}
              className="w-full flex items-center gap-3 bg-base border border-border rounded-xl px-4 py-3 text-left active:scale-[0.98] hover:border-accent"
            >
              <FaFolderOpen className="text-accent shrink-0" size={14} />
              <div>
                <p className="text-sm font-medium">Pilih repository yang sudah ada</p>
                <p className="text-xs text-gray-500">Timpa isinya ke salah satu repo kamu</p>
              </div>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg border border-border text-sm mt-1"
            >
              Batal
            </button>
          </div>
        )}

        {/* --- Mode baru --- */}
        {mode === "new" && (
          <>
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-1.5 text-xs text-gray-400 mb-3"
            >
              <FaArrowLeft size={10} /> Kembali
            </button>

            <label className="text-xs text-gray-400">Nama repository baru</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full mt-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent mb-3"
            />
            <label className="flex items-center gap-2 text-sm mb-4">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-accent"
              />
              Jadikan private
            </label>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                onClick={submit}
                disabled={loading || !newName.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-sm font-medium active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <FaSpinner className="animate-spin" size={13} /> : <FaCloudUploadAlt size={13} />}
                {loading ? "Menyalin..." : "Copy Sekarang"}
              </button>
            </div>
          </>
        )}

        {/* --- Mode existing --- */}
        {mode === "existing" && (
          <>
            <button
              onClick={() => {
                setMode(null);
                setSelected(null);
                setError("");
              }}
              className="flex items-center gap-1.5 text-xs text-gray-400 mb-3"
            >
              <FaArrowLeft size={10} /> Kembali
            </button>

            {!selected ? (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari repository..."
                  className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-accent"
                />
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                  {loadingRepos && <p className="text-xs text-gray-500 py-2">Memuat repo kamu...</p>}
                  {!loadingRepos &&
                    repos
                      ?.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
                      .map((r) => (
                        <button
                          key={r.full_name}
                          onClick={() => setSelected(r)}
                          className="w-full flex items-center gap-2 bg-base border border-border rounded-lg px-3 py-2 text-left hover:border-accent"
                        >
                          {r.private ? (
                            <FaLock size={10} className="text-yellow-500 shrink-0" />
                          ) : (
                            <FaGlobe size={10} className="text-green-500 shrink-0" />
                          )}
                          <span className="text-sm truncate">{r.name}</span>
                        </button>
                      ))}
                  {!loadingRepos && repos?.length === 0 && (
                    <p className="text-xs text-gray-500 py-2">Kamu belum punya repository.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-base border border-border rounded-lg px-3 py-2.5 mb-3 flex items-center justify-between">
                  <span className="text-sm truncate">{selected.full_name}</span>
                  <button onClick={() => setSelected(null)} className="text-xs text-accent shrink-0 ml-2">
                    Ganti
                  </button>
                </div>
                <p className="text-xs text-yellow-400/90 bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-2 mb-4">
                  File dengan nama/path yang sama di repo ini akan ditimpa.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm active:scale-[0.98]"
                  >
                    Batal
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-sm font-medium active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? <FaSpinner className="animate-spin" size={13} /> : <FaCloudUploadAlt size={13} />}
                    {loading ? "Menyalin..." : `Copy ke ${selected.name}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
