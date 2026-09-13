"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft, FaMapMarkerAlt, FaLink, FaBuilding, FaStar,
  FaCodeBranch, FaLock, FaGlobe, FaUserPlus, FaUserCheck, FaCog, FaCircle,
} from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import LiveNumber from "@/components/LiveNumber";
import RoleBadge from "@/components/RoleBadge";

export default function UserProfilePage({ params }: { params: { username: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = (session as any)?.login === params.username;

  async function loadProfile() {
    const pRes = await fetch(`/api/github/user/${params.username}`);
    if (pRes.ok) setProfile(await pRes.json());
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      setLoading(true);
      const [pRes, rRes] = await Promise.all([
        fetch(`/api/github/user/${params.username}`),
        fetch(`/api/github/user/${params.username}/repos`),
      ]);
      if (pRes.ok) setProfile(await pRes.json());
      if (rRes.ok) setRepos(await rRes.json());
      setLoading(false);

      if (!isOwnProfile) {
        const fRes = await fetch(`/api/github/user/${params.username}/follow`);
        if (fRes.ok) setFollowing((await fRes.json()).following);
      }
    })();
  }, [status, params.username, isOwnProfile]);

  // Auto-refresh angka followers/following/repos tiap 15 detik selama
  // halaman ini dibuka & aktif, biar keliatan "realtime" tanpa reload manual.
  useLivePolling(loadProfile, 8000, status === "authenticated" && !loading);

  async function toggleFollow() {
    setFollowLoading(true);
    const method = following ? "DELETE" : "POST";
    const res = await fetch(`/api/github/user/${params.username}/follow`, { method });
    if (res.ok) setFollowing(!following);
    setFollowLoading(false);
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
        <h1 className="font-bold text-lg truncate">{params.username}</h1>
      </header>

      {loading && (
        <div className="px-4 mt-6 space-y-3">
          <div className="w-20 h-20 rounded-full bg-panel animate-pulse" />
          <div className="w-40 h-4 rounded bg-panel animate-pulse" />
        </div>
      )}

      {!loading && profile && (
        <div className="px-4 mt-6">
          <div className="flex items-start gap-4">
            <img src={profile.avatar_url} className="w-20 h-20 rounded-full border border-border" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">{profile.name || profile.login}</h2>
              <p className="text-sm text-gray-500">@{profile.login}</p>
              <div className="mt-1">
                <RoleBadge login={profile.login} size="md" />
              </div>

              {isOwnProfile ? (
                <Link
                  href="/settings/github-profile"
                  className="inline-flex items-center gap-1.5 mt-2 bg-panel border border-border px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  <FaCog size={11} /> Edit Profil
                </Link>
              ) : (
                following !== null && (
                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                      following ? "bg-panel border border-border" : "bg-accent"
                    }`}
                  >
                    {following ? <FaUserCheck size={11} /> : <FaUserPlus size={11} />}
                    {following ? "Following" : "Follow"}
                  </button>
                )
              )}
            </div>
          </div>

          {profile.bio && <p className="text-sm text-gray-300 mt-4">{profile.bio}</p>}

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
            {profile.company && (
              <span className="flex items-center gap-1.5"><FaBuilding size={10} /> {profile.company}</span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1.5"><FaMapMarkerAlt size={10} /> {profile.location}</span>
            )}
            {profile.blog && (
              <a
                href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-accent"
              >
                <FaLink size={10} /> {profile.blog}
              </a>
            )}
          </div>

          <div className="flex items-center gap-4 mt-4 text-sm">
            <Link href={`/users/${params.username}/followers`} className="hover:underline">
              <b><LiveNumber value={profile.followers} /></b> <span className="text-gray-500">followers</span>
            </Link>
            <Link href={`/users/${params.username}/following`} className="hover:underline">
              <b><LiveNumber value={profile.following} /></b> <span className="text-gray-500">following</span>
            </Link>
            <span>
              <b><LiveNumber value={profile.public_repos} /></b> <span className="text-gray-500">repos</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-green-500 ml-auto">
              <FaCircle size={6} className="animate-pulse" /> Live
            </span>
          </div>

          <div className="border-t border-border my-5" />

          <h3 className="text-sm font-semibold mb-3">Project</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {repos.map((repo) => (
              <Link
                key={repo.id}
                href={`/repository/${repo.owner.login}/${repo.name}`}
                className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] hover:border-accent"
              >
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  {repo.private ? (
                    <FaLock size={10} className="text-yellow-500 shrink-0" />
                  ) : (
                    <FaGlobe size={10} className="text-green-500 shrink-0" />
                  )}
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
            {repos.length === 0 && (
              <p className="col-span-full text-sm text-gray-500">Belum ada project.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
