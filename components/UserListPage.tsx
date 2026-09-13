"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaUser, FaCircle } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";

export default function UserListPage({
  username,
  kind,
}: {
  username: string;
  kind: "followers" | "following";
}) {
  const { status } = useSession();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/github/user/${username}/${kind}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .finally(() => setLoading(false));
  }, [status, username, kind]);

  useLivePolling(
    async () => {
      const res = await fetch(`/api/github/user/${username}/${kind}`);
      if (res.ok) setList(await res.json());
    },
    15000,
    status === "authenticated" && !loading
  );

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href={`/users/${username}`} className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg">
          {kind === "followers" ? "Followers" : "Following"} · {username}
        </h1>
        <span className="flex items-center gap-1 text-[10px] text-green-500 ml-auto">
          <FaCircle size={6} className="animate-pulse" /> Live
        </span>
      </header>

      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-panel border border-border animate-pulse" />
          ))}

        {!loading &&
          list.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.login}`}
              className="flex items-center gap-3 bg-panel border border-border rounded-xl p-3 active:scale-[0.98] hover:border-accent"
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

        {!loading && list.length === 0 && (
          <p className="col-span-full text-center text-gray-500 text-sm mt-10">
            {kind === "followers" ? "Belum ada followers." : "Belum mengikuti siapapun."}
          </p>
        )}
      </div>
    </main>
  );
}
