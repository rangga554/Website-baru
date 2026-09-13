"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import {
  FaSearch, FaStar, FaCodeBranch, FaArrowLeft, FaUser, FaGlobe,
} from "react-icons/fa";

type Tab = "repos" | "users";

function SearchContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("repos");
  const [repoResults, setRepoResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  async function runSearch(q: string, t: Tab) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    // Pakai push (bukan replace) biar tiap pencarian baru nambah history
    // browser sendiri-sendiri, jadi tombol Back bisa dipakai buat balik ke
    // hasil pencarian sebelumnya — mirip perilaku Google Search.
    router.push(`/search?q=${encodeURIComponent(q)}`);

    if (t === "repos") {
      const res = await fetch(`/api/github/search-public?q=${encodeURIComponent(q)}`);
      if (res.ok) setRepoResults(await res.json());
    } else {
      const res = await fetch(`/api/github/search-users?q=${encodeURIComponent(q)}`);
      if (res.ok) setUserResults(await res.json());
    }
    setLoading(false);
  }

  // Repo GitHub paling banyak di-star, ditampilin selama user belum ngetik
  // apa-apa — biar halaman Search gak kosong melompong.
  async function loadTrending() {
    setLoadingTrending(true);
    const res = await fetch(`/api/github/search-public?q=${encodeURIComponent("stars:>10000")}`);
    if (res.ok) setTrending(await res.json());
    setLoadingTrending(false);
  }

  useEffect(() => {
    if (initialQ) runSearch(initialQ, tab);
    else loadTrending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabSwitch(t: Tab) {
    setTab(t);
    if (query.trim() && searched) runSearch(query, t);
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <AppLogo size="w-6 h-6" badgeSize="w-3 h-3 text-[7px]" />
          Search
        </h1>
      </header>

      <div className="px-4 mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query, tab)}
          placeholder="Cari project atau user GitHub..."
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => runSearch(query, tab)}
          className="bg-accent px-4 rounded-lg flex items-center gap-2 text-sm font-medium active:scale-[0.98]"
        >
          <FaSearch size={12} />
        </button>
      </div>

      <div className="px-4 mt-4 flex gap-2">
        <button
          onClick={() => handleTabSwitch("repos")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium ${
            tab === "repos" ? "bg-accent text-white" : "bg-panel border border-border text-gray-400"
          }`}
        >
          Repository
        </button>
        <button
          onClick={() => handleTabSwitch("users")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium ${
            tab === "users" ? "bg-accent text-white" : "bg-panel border border-border text-gray-400"
          }`}
        >
          Users
        </button>
      </div>

      {/* --- Hasil Repository --- */}
      {tab === "repos" && searched && (
        <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-panel border border-border animate-pulse" />
            ))}

          {!loading &&
            repoResults.map((repo) => (
              <Link
                key={repo.id}
                href={`/repository/${repo.owner.login}/${repo.name}`}
                className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] transition hover:border-accent"
              >
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  <img src={repo.owner.avatar_url} className="w-4 h-4 rounded-full shrink-0" />
                  <span className="truncate text-gray-400">{repo.owner.login}/</span>
                  <span className="truncate">{repo.name}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 min-h-[2rem]">
                  {repo.description || "Tidak ada deskripsi"}
                </p>
                <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FaStar size={10} /> {repo.stargazers_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaCodeBranch size={10} /> {repo.forks_count}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <FaGlobe size={10} className="text-green-500" />
                  </span>
                </div>
              </Link>
            ))}

          {!loading && repoResults.length === 0 && (
            <p className="col-span-full text-center text-gray-500 text-sm mt-10">
              Tidak ada repository ditemukan.
            </p>
          )}
        </div>
      )}

      {/* --- Hasil Users --- */}
      {tab === "users" && searched && (
        <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-panel border border-border animate-pulse" />
            ))}

          {!loading &&
            userResults.map((u) => (
              <Link
                key={u.id}
                href={`/users/${u.login}`}
                className="flex items-center gap-3 bg-panel border border-border rounded-xl p-3 active:scale-[0.98] transition hover:border-accent"
              >
                <img src={u.avatar_url} className="w-10 h-10 rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.login}</p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <FaUser size={9} /> Lihat profil
                  </p>
                </div>
              </Link>
            ))}

          {!loading && userResults.length === 0 && (
            <p className="col-span-full text-center text-gray-500 text-sm mt-10">
              Tidak ada user ditemukan.
            </p>
          )}
        </div>
      )}

      {/* --- Trending (default, sebelum ada pencarian) --- */}
      {!searched && tab === "repos" && (
        <div className="px-4 mt-6">
          <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            🔥 Trending di GitHub
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {loadingTrending &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-panel border border-border animate-pulse" />
              ))}

            {!loadingTrending &&
              trending.map((repo) => (
                <Link
                  key={repo.id}
                  href={`/repository/${repo.owner.login}/${repo.name}`}
                  className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] transition hover:border-accent"
                >
                  <div className="flex items-center gap-2 text-sm font-medium truncate">
                    <img src={repo.owner.avatar_url} className="w-4 h-4 rounded-full shrink-0" />
                    <span className="truncate text-gray-400">{repo.owner.login}/</span>
                    <span className="truncate">{repo.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 min-h-[2rem]">
                    {repo.description || "Tidak ada deskripsi"}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-500">
                    {repo.language && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-accent inline-block" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FaStar size={10} /> {repo.stargazers_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaCodeBranch size={10} /> {repo.forks_count}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {!searched && tab === "users" && (
        <p className="text-center text-gray-500 text-sm mt-10 px-4">
          Ketik nama user lalu tekan Enter atau tombol cari.
        </p>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
