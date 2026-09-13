"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaCheckCircle, FaGithub } from "react-icons/fa";

export default function GithubProfileSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [blog, setBlog] = useState("");
  const [twitter, setTwitter] = useState("");
  const [avatar, setAvatar] = useState("");
  const [login, setLogin] = useState("");

  const githubConnected = !!(session as any)?.githubConnected;

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!githubConnected) {
      setLoading(false);
      return;
    }
    fetch("/api/github/profile")
      .then((r) => r.json())
      .then((data) => {
        setName(data.name || "");
        setBio(data.bio || "");
        setCompany(data.company || "");
        setLocation(data.location || "");
        setBlog(data.blog || "");
        setTwitter(data.twitter_username || "");
        setAvatar(data.avatar_url || "");
        setLogin(data.login || "");
      })
      .finally(() => setLoading(false));
  }, [status, githubConnected]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/github/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name, bio, company, location, blog, twitter_username: twitter,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      const d = await res.json();
      setError(d.error || "Gagal menyimpan profil");
    }
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/settings" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <FaGithub /> Profil GitHub
        </h1>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500 px-4 mt-6">Memuat profil...</p>
      ) : !githubConnected ? (
        <div className="px-4 mt-6 max-w-md">
          <p className="text-sm text-gray-500">
            Belum ada akun GitHub yang tertaut, jadi belum ada profil GitHub buat
            diedit di sini. Ini beda dari{" "}
            <Link href="/settings" className="text-accent underline">
              Pengaturan KRYNOS
            </Link>{" "}
            (login, password, dll) — tautkan GitHub dulu lewat halaman itu.
          </p>
        </div>
      ) : (
        <div className="px-4 mt-6 max-w-md">
          <p className="text-xs text-gray-500 mb-4 -mt-2">
            Ini profil GitHub kamu (nama, bio, dll) — beda dari{" "}
            <Link href="/settings" className="text-accent underline">
              Pengaturan KRYNOS
            </Link>{" "}
            yang ngatur login/password akun KRYNOS-nya sendiri.
          </p>

          <div className="flex items-center gap-3 mb-5">
            <img src={avatar} className="w-14 h-14 rounded-full border border-border" />
            <div>
              <p className="text-sm font-medium">@{login}</p>
              <a
                href="https://github.com/settings/profile"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent underline"
              >
                Ganti foto profil di GitHub
              </a>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 mb-3 bg-red-950/40 p-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Nama</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Perusahaan</label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Lokasi</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Website / Blog</label>
              <input
                value={blog}
                onChange={(e) => setBlog(e.target.value)}
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Twitter/X username</label>
              <input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="tanpa @"
                className="w-full mt-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent px-5 py-2.5 rounded-lg text-sm font-medium mt-5 disabled:opacity-50"
          >
            {saved && <FaCheckCircle size={13} />}
            {saving ? "Menyimpan..." : saved ? "Tersimpan!" : "Simpan Perubahan"}
          </button>
        </div>
      )}
    </main>
  );
}
