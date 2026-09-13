"use client";

import { useEffect, useState } from "react";
import { FaPlus, FaTag } from "react-icons/fa";

export default function ReleasesPanel({
  owner,
  repo,
  branches,
}: {
  owner: string;
  repo: string;
  branches: string[];
}) {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState(branches[0] || "main");
  const [prerelease, setPrerelease] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/releases`);
    if (res.ok) setReleases(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [owner, repo]);

  async function createRelease() {
    if (!tag.trim()) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/releases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tag_name: tag,
        name: name || tag,
        body,
        target_commitish: target,
        prerelease,
      }),
    });
    if (res.ok) {
      setTag("");
      setName("");
      setBody("");
      setShowNew(false);
      load();
    } else {
      const d = await res.json();
      alert("Gagal: " + d.error);
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">Releases</h2>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs font-medium"
        >
          <FaPlus size={10} /> Baru
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}

      <div className="space-y-2">
        {releases.map((r) => (
          <div key={r.id} className="bg-panel border border-border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FaTag size={11} className="text-accent" />
              <span className="text-sm font-medium">{r.name || r.tag_name}</span>
              {r.prerelease && (
                <span className="text-[10px] bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">
                  pre-release
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{r.tag_name}</p>
            {r.body && (
              <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap line-clamp-3">
                {r.body}
              </p>
            )}
          </div>
        ))}
        {!loading && releases.length === 0 && (
          <p className="text-sm text-gray-500">Belum ada release.</p>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[90dvh] overflow-y-auto">
            <h3 className="font-semibold mb-3 text-sm">Release Baru</h3>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag, contoh: v1.0.0"
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none mb-2 focus:border-accent"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Judul release (opsional)"
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none mb-2 focus:border-accent"
            />
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none mb-2"
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Catatan rilis..."
              rows={4}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none mb-2 focus:border-accent"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prerelease}
                onChange={(e) => setPrerelease(e.target.checked)}
                className="accent-accent"
              />
              Tandai sebagai pre-release
            </label>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                onClick={createRelease}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium"
              >
                Publish Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
