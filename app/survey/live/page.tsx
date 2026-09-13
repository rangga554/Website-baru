"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import RoleBadge from "@/components/RoleBadge";
import LiveNumber from "@/components/LiveNumber";
import type { SurveyResponse } from "@/lib/survey";

type LiveData = {
  weekKey: string;
  total: number;
  responses: SurveyResponse[];
};

export default function SurveyLivePage() {
  const { status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/survey/live");
      if (!res.ok) return;
      const next: LiveData = await res.json();

      // Cuma tandai baris yang BENERAN baru (belum pernah muncul sebelumnya)
      // biar animasi "masuk" cuma jalan sekali per respon, bukan tiap poll.
      const newlySeen = new Set<string>();
      for (const r of next.responses) {
        if (!seenIds.current.has(r.id)) {
          seenIds.current.add(r.id);
          newlySeen.add(r.id);
        }
      }
      if (newlySeen.size > 0) {
        setFreshIds(newlySeen);
        setTimeout(() => setFreshIds(new Set()), 1200);
      }

      setData(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh]);

  // Update mulus tiap 1 detik, otomatis pause kalau tab lagi gak keliatan.
  useLivePolling(refresh, 1000, status === "authenticated");

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
        <h1 className="font-bold text-lg flex-1">Kotak Saran — Live</h1>
        <span className="text-xs text-gray-500">
          {data ? data.weekKey : ""}
        </span>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500 px-4 mt-6">Memuat...</p>
      ) : (
        <div className="px-4 mt-4 max-w-2xl mx-auto flex flex-col gap-4">
          <div className="bg-panel border border-border rounded-lg px-3 py-3 text-center">
            <div className="text-2xl font-bold">
              <LiveNumber value={data?.total ?? 0} />
            </div>
            <div className="text-xs text-gray-500 mt-1">Total saran masuk minggu ini</div>
          </div>

          {(!data || data.responses.length === 0) && (
            <p className="text-sm text-gray-500 text-center mt-6">
              Belum ada saran yang masuk minggu ini.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {data?.responses.map((r) => (
              <div
                key={r.id}
                className={`bg-panel border border-border rounded-lg p-4 transition-all duration-700 ${
                  freshIds.has(r.id)
                    ? "border-accent bg-accent/5"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {r.avatar_url && (
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium">{r.login}</span>
                  <RoleBadge login={r.login} />
                </div>

                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                  {r.reason}
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  {new Date(r.created_at).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
