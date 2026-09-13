"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CollaboratorSettings from "./CollaboratorSettings";

export default function RepoSettings({
  owner,
  repo,
  info,
  onUpdated,
}: {
  owner: string;
  repo: string;
  info: any;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(info.name || repo);
  const [description, setDescription] = useState(info.description || "");
  const [isPrivate, setIsPrivate] = useState(info.private);
  const [defaultBranch, setDefaultBranch] = useState(info.default_branch);
  const [hasIssues, setHasIssues] = useState(info.has_issues);
  const [hasWiki, setHasWiki] = useState(info.has_wiki);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [bypassSecret, setBypassSecret] = useState("");
  const [bypassLoading, setBypassLoading] = useState(true);
  const [bypassSaving, setBypassSaving] = useState(false);
  const [bypassSaved, setBypassSaved] = useState(false);
  const [bypassError, setBypassError] = useState("");

  useEffect(() => {
    fetch(`/api/vercel/protection?owner=${owner}&repo=${repo}`)
      .then((r) => r.json())
      .then((d) => setBypassSecret(d.bypassSecret || ""))
      .finally(() => setBypassLoading(false));
  }, [owner, repo]);

  async function saveBypassSecret() {
    setBypassSaving(true);
    setBypassSaved(false);
    setBypassError("");
    const res = await fetch("/api/vercel/protection", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, repo, bypassSecret }),
    });
    setBypassSaving(false);
    if (res.ok) {
      setBypassSaved(true);
      setTimeout(() => setBypassSaved(false), 2500);
    } else {
      const d = await res.json().catch(() => ({}));
      setBypassError(d.error || "Gagal menyimpan token");
    }
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert("Nama repository tidak boleh kosong");
      return;
    }
    const renamed = trimmedName !== repo;

    if (renamed) {
      const ok = confirm(
        `Ganti nama repository dari "${repo}" jadi "${trimmedName}"?\n\n` +
          `Semua link lama (URL editor, clone URL, dsb) yang masih pakai nama lama akan otomatis di-redirect oleh GitHub, tapi lebih aman diperbarui manual kalau ada yang kamu simpan di tempat lain.`
      );
      if (!ok) return;
    }

    setSaving(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        description,
        private: isPrivate,
        default_branch: defaultBranch,
        has_issues: hasIssues,
        has_wiki: hasWiki,
      }),
    });
    setSaving(false);
    if (res.ok) {
      if (renamed) {
        // URL editor sekarang bergantung ke nama repo lama — pindah ke URL
        // baru biar gak nyangkut di halaman yang udah gak valid.
        router.replace(`/editor/${owner}/${trimmedName}?tab=settings`);
      } else {
        onUpdated();
      }
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Gagal menyimpan pengaturan");
    }
  }

  async function deleteRepo() {
    if (
      !confirm(
        `Yakin ingin hapus repository "${owner}/${repo}"? Tindakan ini TIDAK BISA dibatalkan.`
      )
    )
      return;
    const typed = prompt(`Ketik "${repo}" untuk konfirmasi hapus:`);
    if (typed !== repo) return;

    setDeleting(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/settings`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) router.replace("/dashboard");
    else alert("Gagal menghapus repository");
  }

  return (
    <div className="p-4 space-y-5 max-w-xl">
      <h2 className="font-semibold text-base">Pengaturan Repository</h2>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400">Nama Repository</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent font-mono"
          />
          {name.trim() !== repo && (
            <p className="text-[11px] text-yellow-400 mt-1.5">
              URL repo ini bakal berubah jadi /{owner}/{name.trim() || "..."}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-400">Deskripsi</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400">Default branch</label>
          <input
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <label className="flex items-center justify-between text-sm py-1">
          Private repository
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
        </label>

        <label className="flex items-center justify-between text-sm py-1">
          Aktifkan Issues
          <input
            type="checkbox"
            checked={hasIssues}
            onChange={(e) => setHasIssues(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
        </label>

        <label className="flex items-center justify-between text-sm py-1">
          Aktifkan Wiki
          <input
            type="checkbox"
            checked={hasWiki}
            onChange={(e) => setHasWiki(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full sm:w-auto bg-accent px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Menyimpan..." : "Simpan Perubahan"}
      </button>

      <div className="border-t border-border pt-4 mt-6">
        <h3 className="text-sm font-semibold mb-1">Live Preview (Vercel)</h3>
        <p className="text-xs text-gray-400 mb-3">
          Kalau project Vercel repo ini di-protect (Deployment Protection / Vercel
          Authentication), masukin{" "}
          <b>Protection Bypass for Automation</b> secret di sini biar Live
          Preview tetap bisa dibuka tanpa halaman "request access". Ambil dari
          Vercel: Project Settings → Deployment Protection → Protection
          Bypass for Automation.
        </p>

        {bypassLoading ? (
          <p className="text-xs text-gray-500">Memuat...</p>
        ) : (
          <>
            <input
              type="password"
              value={bypassSecret}
              onChange={(e) => setBypassSecret(e.target.value)}
              placeholder="Kosongkan kalau project ini tidak di-protect"
              className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
            {bypassError && (
              <p className="text-xs text-red-400 mt-2">{bypassError}</p>
            )}
            <button
              onClick={saveBypassSecret}
              disabled={bypassSaving}
              className="mt-3 w-full sm:w-auto bg-panel border border-border px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {bypassSaving ? "Menyimpan..." : bypassSaved ? "Tersimpan!" : "Simpan Token"}
            </button>
          </>
        )}
      </div>

      <div className="border-t border-border pt-4 mt-6">
        <h3 className="text-sm font-semibold mb-1">Collaboration</h3>
        <p className="text-xs text-gray-400 mb-3">
          Undang user KRYNOS lain (harus login GitHub) buat edit bareng repo ini.
        </p>
        <CollaboratorSettings owner={owner} repo={repo} />
      </div>

      <div className="border-t border-red-900/50 pt-4 mt-6">
        <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-3">
          Menghapus repository bersifat permanen dan tidak bisa dibatalkan.
        </p>
        <button
          onClick={deleteRepo}
          disabled={deleting}
          className="w-full sm:w-auto bg-red-900/40 border border-red-800 text-red-300 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {deleting ? "Menghapus..." : "Hapus Repository"}
        </button>
      </div>
    </div>
  );
}
