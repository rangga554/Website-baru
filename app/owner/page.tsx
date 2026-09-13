"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { FaShieldAlt, FaServer, FaBolt, FaExternalLinkAlt, FaUsers, FaUserClock, FaChartLine, FaClock, FaPoll, FaUserPlus, FaBan, FaTrophy, FaCommentDots, FaBullhorn, FaUsersCog } from "react-icons/fa";
import { useRole } from "@/lib/useRole";
import { useLivePolling } from "@/lib/useLivePolling";
import LiveNumber from "@/components/LiveNumber";
import PlusReviewPanel from "@/components/PlusReviewPanel";
import DbConnectionsPanel from "@/components/DbConnectionsPanel";
import RedeemCodePanel from "@/components/RedeemCodePanel";
import UserManagementPanel from "@/components/UserManagementPanel";
import ContentModerationPanel from "@/components/ContentModerationPanel";
import AdminManagementPanel from "@/components/AdminManagementPanel";
import DeveloperManagementPanel from "@/components/DeveloperManagementPanel";
import ActivityLogsPanel from "@/components/ActivityLogsPanel";
import AutoFollowBackfillButton from "@/components/AutoFollowBackfillButton";
import EventPanel from "@/components/EventPanel";
import TemplateManagementPanel from "@/components/TemplateManagementPanel";

type OwnerStats = {
  totalRegisteredUsers: number;
  activeUsers: number;
  averageMonthlyActiveUsers: number;
  averageUsageSeconds: number;
  averageSurveyRespondentsPerWeek: number;
  newUsersLast7Days: number;
  bannedUsersCount: number;
  topActiveUsers: { login: string; avatar_url: string | null; total_active_seconds: number }[];
  totalCommunityMessages: number;
  totalAnnouncements: number;
  totalCollaborations: number;
};

// Format detik jadi "1j 23m" / "45m" biar gampang dibaca, bukan angka detik
// mentah.
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}j ${minutes}m`;
  return `${minutes}m`;
}

export default function OwnerPanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [error, setError] = useState("");

  const login = (session as any)?.login as string | undefined;
  const role = useRole(login);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    // Tunggu role.loading kelar dulu SEBELUM mutusin redirect — kalau
    // enggak, admin (yang isOwner-nya false tapi isAdmin-nya belum
    // ke-fetch) bisa ke-tendang duluan padahal harusnya boleh masuk.
    if (status === "authenticated" && !role.loading && !role.isPrivileged) {
      router.replace("/dashboard");
    }
  }, [status, role.loading, role.isPrivileged, router]);

  async function loadStats() {
    const res = await fetch("/api/owner/stats");
    if (res.ok) {
      setStats(await res.json());
      setError("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Gagal memuat statistik");
    }
  }

  useEffect(() => {
    if (status === "authenticated" && role.isPrivileged) loadStats();
  }, [status, role.isPrivileged]);

  // Auto-refresh tiap 15 detik selama halaman ini dibuka & tab aktif.
  useLivePolling(loadStats, 15000, status === "authenticated" && role.isPrivileged);

  if (status !== "authenticated" || role.loading || !role.isPrivileged) return null;

  const cards = stats
    ? [
        {
          label: "Jumlah User Terdaftar",
          value: stats.totalRegisteredUsers,
          icon: FaUsers,
        },
        {
          label: "Jumlah User Aktif",
          value: stats.activeUsers,
          icon: FaUserClock,
          hint: "Aktif dalam 24 jam terakhir",
        },
        {
          label: "Rata-Rata Jumlah User Aktif Bulanan",
          value: stats.averageMonthlyActiveUsers,
          icon: FaChartLine,
          hint: "Aktif dalam 30 hari terakhir",
        },
        {
          label: "Rata-Rata Waktu Pakai",
          value: formatDuration(stats.averageUsageSeconds),
          icon: FaClock,
          hint: "Rata-rata seluruh user, sepanjang waktu",
        },
        {
          label: "Rata-Rata Survey per Minggu",
          value: stats.averageSurveyRespondentsPerWeek,
          icon: FaPoll,
          hint: "Rata-rata jumlah pengirim, dari semua minggu",
        },
        {
          label: "User Baru (7 Hari Terakhir)",
          value: stats.newUsersLast7Days,
          icon: FaUserPlus,
        },
        {
          label: "User Diblokir",
          value: stats.bannedUsersCount,
          icon: FaBan,
        },
        {
          label: "Total Pesan Komunitas",
          value: stats.totalCommunityMessages,
          icon: FaCommentDots,
          hint: "Sejak siklus reset terakhir",
        },
        {
          label: "Total Announcement",
          value: stats.totalAnnouncements,
          icon: FaBullhorn,
        },
        {
          label: "Collaboration Aktif",
          value: stats.totalCollaborations,
          icon: FaUsersCog,
        },
      ]
    : [];

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-20 bg-[#080b14]/85 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size="w-9 h-9" rounded="rounded-xl" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg tracking-tight">KRYNOS <span className="text-violet-400">CONTROL</span></h1>
                <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/20">OWNER</span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono">@{login} · privileged console</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-xs px-3 py-2 rounded-lg border border-white/10 hover:border-violet-400/40 hover:text-violet-300 transition">Dashboard ↗</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/10 to-cyan-400/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[.18em] text-violet-300 font-bold">KRYNOS Command Center</p>
              <p className="text-sm font-semibold mt-1">Semua kontrol penting ada dalam satu console.</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-500">OWNER</p>
              <p className="font-mono text-xs text-cyan-300">@{login}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            {error.includes("SUPABASE") && (
              <p className="mt-1 text-xs text-red-300/70">
                Owner Panel butuh Supabase (lihat README bagian 2c) plus
                tabel <code>user_activity</code> tambahan (lihat komentar di
                lib/ownerStats.ts).
              </p>
            )}
          </div>
        )}

        {!stats && !error && (
          <p className="text-sm text-gray-400">Memuat statistik...</p>
        )}

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-panel/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,.18)] hover:border-violet-400/25 transition"
              >
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <card.icon />
                  {card.label}
                </div>
                <div className="text-2xl font-bold">
                  {typeof card.value === "number" ? (
                    <LiveNumber value={card.value} />
                  ) : (
                    card.value
                  )}
                </div>
                {card.hint && (
                  <div className="text-[11px] text-gray-500 mt-1">{card.hint}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {stats && (
          <section className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["/dashboard", "Dashboard", "Kelola akun & project", FaServer],
              ["/dev", "Dev Panel", "Tools developer", FaBolt],
              ["/settings", "Settings", "Konfigurasi akun", FaShieldAlt],
              ["/search", "GitHub Search", "Cari repo & user", FaExternalLinkAlt],
            ].map(([href, title, desc, Icon]: any) => (
              <Link key={title} href={href} className="group rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:bg-violet-500/[.06] hover:border-violet-400/30 transition">
                <Icon className="text-violet-400 mb-3" size={16} />
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-[11px] text-gray-500 mt-1">{desc}</p>
              </Link>
            ))}
          </section>
        )}

        {stats && stats.topActiveUsers.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-panel p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-3">
              <FaTrophy /> Top 5 User Paling Aktif
            </div>
            <div className="space-y-2">
              {stats.topActiveUsers.map((u, i) => (
                <div key={u.login} className="flex items-center gap-2.5">
                  <span className="text-xs text-gray-500 w-4 shrink-0">{i + 1}</span>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="w-6 h-6 rounded-full shrink-0" alt="" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/10 shrink-0" />
                  )}
                  <span className="text-sm truncate flex-1">{u.login}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatDuration(u.total_active_seconds)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <PlusReviewPanel />
        <UserManagementPanel />
        <ContentModerationPanel />
        {role.isOwner && <AdminManagementPanel />}
        {role.isOwner && <DeveloperManagementPanel />}
        {role.isOwner && <AutoFollowBackfillButton />}
        {role.isOwner && <ActivityLogsPanel />}
        {role.isOwner && <EventPanel />}
        {role.isOwner && <TemplateManagementPanel />}
        {role.isOwner && (
          <div className="mt-8 pt-6 border-t border-border">
            <DbConnectionsPanel />
          </div>
        )}
        <RedeemCodePanel />
      </div>
    </main>
  );
}
