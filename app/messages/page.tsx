"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaComments, FaCrown, FaUserShield } from "react-icons/fa";
import { useRole } from "@/lib/useRole";
import RoleBadge from "@/components/RoleBadge";
import { useLivePolling } from "@/lib/useLivePolling";

type MessageTarget = {
  login: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
};

type Conversation = {
  id: string;
  user_login: string;
  admin_login: string;
  last_message_at: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru aja";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j`;
  return `${Math.floor(hours / 24)}h`;
}

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const login = (session as any)?.login as string | undefined;
  const { isPrivileged, loading: roleLoading } = useRole(login);

  const [targets, setTargets] = useState<MessageTarget[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingWith, setStartingWith] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const convRes = await fetch("/api/messages/conversations");
      const convData = await convRes.json();
      setConversations(convData.conversations || []);

      // Cuma user biasa yang butuh daftar target (owner/admin gak bisa
      // mulai obrolan baru, jadi gak perlu daftar ini).
      if (!isPrivileged) {
        const targetRes = await fetch("/api/messages/targets");
        const targetData = await targetRes.json();
        setTargets(targetData.targets || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || roleLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roleLoading, isPrivileged]);

  // Daftar percakapan auto-update tiap 5 detik, tanpa reload halaman.
  useLivePolling(load, 5000, status === "authenticated" && !roleLoading);

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  async function openOrStart(targetLogin: string) {
    setError("");
    const existing = conversations.find(
      (c) => c.admin_login.toLowerCase() === targetLogin.toLowerCase()
    );
    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }
    setStartingWith(targetLogin);
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetLogin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai obrolan");
      router.push(`/messages/${data.conversation.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStartingWith(null);
    }
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-bold flex items-center gap-2">
          <FaComments className="text-accent" /> Message
        </h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading || roleLoading ? (
          <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>
        ) : isPrivileged ? (
          <>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Ini daftar obrolan yang MASUK dari user. Owner/Admin cuma bisa balas obrolan yang
              udah dimulai user, gak bisa mulai obrolan baru duluan.
            </p>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">
                Belum ada obrolan masuk.
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/messages/${c.id}`)}
                    className="w-full flex items-center gap-3 bg-panel border border-border rounded-xl p-3 text-left hover:border-accent/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-border shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {c.user_login}
                        <RoleBadge login={c.user_login} />
                      </p>
                      <p className="text-[11px] text-gray-500">{timeAgo(c.last_message_at)} lalu</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Pilih Owner atau Admin buat mulai obrolan.
            </p>
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <div className="space-y-2">
              {targets.map((t) => {
                const existing = conversations.find(
                  (c) => c.admin_login.toLowerCase() === t.login.toLowerCase()
                );
                return (
                  <button
                    key={t.login}
                    onClick={() => openOrStart(t.login)}
                    disabled={startingWith === t.login}
                    className="w-full flex items-center gap-3 bg-panel border border-border rounded-xl p-3 text-left hover:border-accent/50 disabled:opacity-50"
                  >
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-border shrink-0 flex items-center justify-center">
                        {t.role === "owner" ? (
                          <FaCrown className="text-amber-400" size={14} />
                        ) : (
                          <FaUserShield className="text-emerald-400" size={14} />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {t.login}
                        <RoleBadge login={t.login} />
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {existing ? `Ada obrolan · ${timeAgo(existing.last_message_at)} lalu` : "Mulai obrolan baru"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
