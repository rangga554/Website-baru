"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FaArrowLeft, FaStar, FaCodeBranch, FaLock, FaGlobe, FaCode,
  FaExternalLinkAlt, FaEye, FaCircle,
} from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import LiveNumber from "@/components/LiveNumber";

export default function RepositoryPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const { status } = useSession();
  const router = useRouter();
  const [info, setInfo] = useState<any>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState<boolean | null>(null);
  const [starLoading, setStarLoading] = useState(false);
  const [starCount, setStarCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      setLoading(true);
      const [infoRes, readmeRes, starRes] = await Promise.all([
        fetch(`/api/github/repo/${params.owner}/${params.repo}/settings`),
        fetch(`/api/github/repo/${params.owner}/${params.repo}/readme`),
        fetch(`/api/github/repo/${params.owner}/${params.repo}/star`),
      ]);
      if (infoRes.ok) {
        const data = await infoRes.json();
        setInfo(data);
        setStarCount(data.stargazers_count || 0);
      }
      if (readmeRes.ok) setReadme((await readmeRes.json()).content);
      if (starRes.ok) setStarred((await starRes.json()).starred);
      setLoading(false);
    })();
  }, [status, params.owner, params.repo]);

  // Auto-refresh statistik repo (star/fork/watcher) tiap 15 detik selama
  // halaman ini dibuka & aktif, biar keliatan "realtime".
  useLivePolling(
    async () => {
      const res = await fetch(`/api/github/repo/${params.owner}/${params.repo}/settings`);
      if (res.ok) {
        const data = await res.json();
        setInfo((prev: any) => (prev ? { ...prev, ...data } : data));
        setStarCount(data.stargazers_count || 0);
      }
    },
    8000,
    status === "authenticated" && !loading
  );

  async function toggleStar() {
    setStarLoading(true);
    const method = starred ? "DELETE" : "POST";
    const res = await fetch(`/api/github/repo/${params.owner}/${params.repo}/star`, { method });
    if (res.ok) {
      setStarred(!starred);
      setStarCount((c) => c + (starred ? -1 : 1));
    }
    setStarLoading(false);
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/search" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg truncate">
          {params.owner}/{params.repo}
        </h1>
      </header>

      {loading && (
        <div className="px-4 mt-6 space-y-3">
          <div className="w-full h-6 rounded bg-panel animate-pulse" />
          <div className="w-2/3 h-4 rounded bg-panel animate-pulse" />
        </div>
      )}

      {!loading && info && (
        <div className="px-4 mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <img src={info.owner.avatar_url} className="w-5 h-5 rounded-full" />
                <Link href={`/users/${info.owner.login}`} className="text-sm text-accent hover:underline">
                  {info.owner.login}
                </Link>
                <span className="text-gray-500">/</span>
                <h2 className="font-semibold truncate">{info.name}</h2>
              </div>
              {info.description && (
                <p className="text-sm text-gray-400 mt-2">{info.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <button
              onClick={toggleStar}
              disabled={starLoading || starred === null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                starred ? "bg-yellow-900/40 border border-yellow-800 text-yellow-300" : "bg-panel border border-border"
              }`}
            >
              <FaStar size={11} className={starred ? "text-yellow-400" : ""} />
              {starred ? "Favorited" : "Favorite"} · <LiveNumber value={starCount} />
            </button>

            <Link
              href={`/editor/${params.owner}/${params.repo}`}
              className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <FaCode size={11} /> Buka di Editor
            </Link>

            <a
              href={info.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-panel border border-border px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              GitHub <FaExternalLinkAlt size={9} />
            </a>
          </div>

          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            {info.private ? (
              <span className="flex items-center gap-1.5"><FaLock size={10} className="text-yellow-500" /> Private</span>
            ) : (
              <span className="flex items-center gap-1.5"><FaGlobe size={10} className="text-green-500" /> Public</span>
            )}
            {info.language && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent inline-block" /> {info.language}
              </span>
            )}
            <span className="flex items-center gap-1.5"><FaCodeBranch size={10} /> {info.forks_count} forks</span>
            <span className="flex items-center gap-1.5"><FaEye size={10} /> {info.watchers_count} watching</span>
            <span className="flex items-center gap-1 text-[10px] text-green-500 ml-auto">
              <FaCircle size={6} className="animate-pulse" /> Live
            </span>
          </div>

          <div className="border-t border-border my-5" />

          {readme ? (
            <div className="prose prose-invert prose-sm max-w-none bg-panel border border-border rounded-xl p-4 overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{readme}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Repo ini belum punya README.</p>
          )}
        </div>
      )}
    </main>
  );
}
