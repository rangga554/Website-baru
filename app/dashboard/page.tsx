"use client";

import { useEffect, useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import NewRepoModal from "@/components/NewRepoModal";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { FaLock, FaGlobe, FaPlus, FaCodeBranch, FaStar, FaBars, FaGithub, FaUsers, FaRobot, FaArrowRight, FaRocket } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import { useRole } from "@/lib/useRole";
import RatingPromptGate from "@/components/RatingPromptGate";
import AdSlot from "@/components/AdSlot";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// Video promo: PAKAI env var NEXT_PUBLIC_PROMO_VIDEO_URL kalau di-set (isi
// dengan public URL dari Supabase Storage/CDN lain), fallback ke file lokal
// public/promo/mastercode-promo.mp4 kalau belum. Google Drive UDAH DICOBA
// dan gak bisa dipake buat ini (lihat catatan di render-nya di bawah).
const PROMO_VIDEO_URL =
  process.env.NEXT_PUBLIC_PROMO_VIDEO_URL || "/promo/mastercode-promo.mp4";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "repository" | "collaboration" | "vercel" | "netlify">("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collabAccepted, setCollabAccepted] = useState<any[]>([]);
  // Status koneksi Aplikasi Pihak Ketiga (Vercel/Netlify) — dipakai buat
  // nambahin tab filter Dashboard secara DINAMIS: kalau user cuma connect
  // Vercel, tab yang muncul cuma "Vercel"; kalau cuma Netlify, cuma
  // "Netlify"; kalau dua-duanya, dua-duanya muncul.
  const [thirdParty, setThirdParty] = useState<{
    vercel: { connected: boolean; projects?: any[]; error?: string } | null;
    netlify: { connected: boolean; sites?: any[]; error?: string } | null;
  }>({ vercel: null, netlify: null });

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/vercel-connect/status").then((r) => r.json()).catch(() => ({ connected: false })),
      fetch("/api/netlify-connect/status").then((r) => r.json()).catch(() => ({ connected: false })),
    ]).then(([vercel, netlify]) => setThirdParty({ vercel, netlify }));
  }, [status]);

  // Undangan collaboration yang PENDING sekarang ditangani lewat dropdown
  // notifikasi (NotificationBell) di header, bukan banner di sini lagi.
  async function loadCollaboration() {
    const res = await fetch("/api/collaboration/mine");
    if (res.ok) {
      const d = await res.json();
      setCollabAccepted(d.accepted || []);
    }
  }

  // GUEST MODE: dulu di sini ada redirect paksa ke /login kalau
  // "unauthenticated" — SENGAJA DIHAPUS. Sekarang visitor tanpa session
  // boleh buka Dashboard sebagai Guest (liat-liat doang), gak dipentalin.
  // Semua fetch data di atas udah pada dijaga `status === "authenticated"`
  // jadi aman render kosong buat Guest.

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.banned) router.replace("/banned");
      })
      .catch(() => {});
  }, [status, router]);

  // Catet device (buat notifikasi "Perangkat baru login") — dipanggil dari
  // SINI (client, abis login-nya sendiri kelar sukses), BUKAN dari dalam
  // proses NextAuth. Sekali per tab browser doang (bukan tiap dashboard
  // ke-render ulang), pakai sessionStorage sebagai penanda.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (sessionStorage.getItem("mc_device_checked") === "1") return;
    sessionStorage.setItem("mc_device_checked", "1");
    fetch("/api/auth/record-device", { method: "POST" }).catch(() => {});
  }, [status]);

  const githubConnected = !!(session as any)?.githubConnected;
  const role = useRole((session as any)?.login);

  async function loadRepos() {
    if (!githubConnected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/github/repos");
    if (res.ok) setRepos(await res.json());
    setLoading(false);
  }

  // Sama kayak loadRepos, tapi TANPA toggle setLoading — dipakai buat
  // auto-refresh biar list-nya update senyap tanpa nunjukin loading spinner
  // tiap 5 detik.
  async function refreshReposSilent() {
    if (!githubConnected) return;
    const res = await fetch("/api/github/repos");
    if (res.ok) setRepos(await res.json());
  }

  useEffect(() => {
    if (status === "authenticated") {
      loadRepos();
      loadCollaboration();
    }
  }, [status, githubConnected]);

  // Live: daftar repo auto-refresh tiap 5 detik selama halaman ini dibuka &
  // tab aktif (otomatis berhenti kalau tab di-minimize/background).
  useLivePolling(refreshReposSilent, 5000, status === "authenticated" && !loading && githubConnected);

  const filtered = repos.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="min-h-dvh bg-base pb-10">
      <RatingPromptGate />
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
              className="p-1.5 -ml-1.5 rounded-md text-gray-300 hover:bg-white/5 active:scale-95"
            >
              <FaBars size={18} />
            </button>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <AppLogo />
              Master <span className="text-accent">Code</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {(session as any)?.avatar && (
              <Link href={`/users/${(session as any).login}`}>
                <img
                  src={(session as any).avatar}
                  className="w-8 h-8 rounded-full"
                  alt="avatar"
                />
              </Link>
            )}
          </div>
        </div>
      </header>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        login={(session as any)?.login}
        avatarUrl={(session as any)?.avatar}
        isOwnerUser={role.isPrivileged}
        isDeveloperUser={role.isDeveloper}
        panelLabel={role.isOwner ? "Owner Panel" : "Admin Panel"}
        onSignOut={() => {
          if (confirm("Yakin mau keluar dari akun ini?")) {
            signOut({ callbackUrl: "/login" });
          }
        }}
      />

      {status !== "authenticated" && (
        <div className="px-4 mt-4">
          <div className="bg-gradient-to-br from-accent/20 via-panel to-violet-600/20 border border-accent/30 rounded-xl px-4 py-4">
            <p className="text-sm font-medium mb-0.5">Mode Guest — liat-liat doang dulu 👀</p>
            <p className="text-xs text-gray-400 mb-3">Login buat nyambungin GitHub, bikin project, dan pake semua fitur KRYNOS.</p>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 bg-accent text-black font-medium text-sm py-2.5 rounded-lg active:scale-[0.98] transition"
            >
              <FaRocket size={13} /> Ayo Mulai Kembangkan Project
            </Link>
          </div>
        </div>
      )}

      {/* Iklan: banner 728x90, cuma muncul di layar lebar (md ke atas) —
         di layar HP kesempitan/gak muat rapi, mending dilewatin di sana. */}
      <div className="px-4 mt-4 hidden md:flex justify-center">
        <AdSlot variant="728x90" />
      </div>

      <div className="px-4 mt-4">
        <Link
          href="/ai"
          className="flex items-center gap-3 bg-gradient-to-br from-violet-600/20 via-panel to-accent/20 border border-accent/30 rounded-xl px-4 py-3.5 active:scale-[0.98] transition hover:border-accent"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-accent flex items-center justify-center shrink-0">
            <FaRobot size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">KRYNOS AI</p>
              <span className="text-[9px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Ngobrol & bikin website pakai AI, tersimpan lokal</p>
          </div>
          <FaArrowRight size={12} className="text-gray-500 shrink-0" />
        </Link>
      </div>

      <div className="px-4 mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("dashboard.searchPlaceholder")}
          className="flex-1 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => setShowNew(true)}
          className="bg-accent px-4 rounded-lg flex items-center gap-2 text-sm font-medium active:scale-[0.98]"
          disabled={!githubConnected}
        >
          <FaPlus size={12} />
          <span className="hidden xs:inline">{t("dashboard.newRepo")}</span>
        </button>
      </div>

      <div className="px-4 mt-3 flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: t("dashboard.filterAll") },
          { key: "repository", label: t("dashboard.filterOwn") },
          { key: "collaboration", label: t("dashboard.filterCollab") },
          ...(thirdParty.vercel?.connected ? [{ key: "vercel", label: "Vercel" }] : []),
          ...(thirdParty.netlify?.connected ? [{ key: "netlify", label: "Netlify" }] : []),
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key as any)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
              filterType === tab.key
                ? "bg-accent border-accent text-white font-medium"
                : "bg-panel border-border text-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filterType === "vercel" && (
        <div className="px-4 mt-4">
          {thirdParty.vercel?.error ? (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              Akun Vercel kamu lagi bermasalah: {thirdParty.vercel.error}. Cek di{" "}
              <Link href="/third-party-apps" className="underline">Aplikasi Pihak Ketiga</Link>.
            </p>
          ) : (thirdParty.vercel?.projects || []).length === 0 ? (
            <p className="text-xs text-gray-500">Belum ada project di akun Vercel kamu.</p>
          ) : (
            <div className="space-y-1.5">
              {(thirdParty.vercel?.projects || []).map((p: any) => (
                <Link
                  key={p.id}
                  href={`/third-party-apps/vercel/${p.id}`}
                  className="bg-panel border border-border rounded-lg px-3 py-2.5 text-sm flex items-center justify-between"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">Vercel</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/third-party-apps" className="text-xs text-accent inline-block mt-3">
            Kelola koneksi Vercel →
          </Link>
        </div>
      )}

      {filterType === "netlify" && (
        <div className="px-4 mt-4">
          {thirdParty.netlify?.error ? (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              Akun Netlify kamu lagi bermasalah: {thirdParty.netlify.error}. Cek di{" "}
              <Link href="/third-party-apps" className="underline">Aplikasi Pihak Ketiga</Link>.
            </p>
          ) : (thirdParty.netlify?.sites || []).length === 0 ? (
            <p className="text-xs text-gray-500">Belum ada site di akun Netlify kamu.</p>
          ) : (
            <div className="space-y-1.5">
              {(thirdParty.netlify?.sites || []).map((s: any) => (
                <Link
                  key={s.id}
                  href={`/third-party-apps/netlify/${s.id}`}
                  className="bg-panel border border-border rounded-lg px-3 py-2.5 text-sm flex items-center justify-between"
                >
                  <span className="truncate">{s.name}</span>
                  <span className="text-[10px] text-gray-500 shrink-0">Netlify</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/third-party-apps" className="text-xs text-accent inline-block mt-3">
            Kelola koneksi Netlify →
          </Link>
        </div>
      )}

      {/* Dulu di sini iklan Adsterra (320x50), sekarang diganti video promo
         KRYNOS sendiri. Audionya udah di-strip pas processing (gak ada
         musik/suara sama sekali) — muted/autoPlay/loop/playsInline biar
         jalan otomatis di semua browser & di dalam APK native juga.

         CATATAN soal hosting videonya (biar gak keulang lagi):
         - Google Drive TERBUKTI GAK BISA dipake buat ini — link Drive
           (apapun bentuknya, termasuk uc?export=download) gak nyajiin
           file video mentah ke tag <video>, hasilnya cuma ikon "video
           rusak". Drive cuma cocok dibuka manual/lewat iframe preview-nya
           sendiri, bukan buat di-embed langsung kayak gini.
         - Solusi yang bener: upload video ke SUPABASE STORAGE (bucket
           publik — project ini udah pake Supabase Storage buat gambar/
           musik komunitas, lihat lib/storage.ts), lalu isi env var
           NEXT_PUBLIC_PROMO_VIDEO_URL di Vercel dengan public URL-nya.
           Supabase Storage nyajiin Content-Type & Range request yang
           bener, jadi <video> bisa muter/nge-stream normal.
         - Kalau env var itu belum di-set, otomatis fallback ke file lokal
           di public/promo/mastercode-promo.mp4 (yang lagi dipake sekarang)
           biar video tetep muncul normal. */}
      <div className="px-4 mt-3 flex md:hidden justify-center">
        <video
          src={PROMO_VIDEO_URL}
          className="w-full max-w-[500px] rounded-xl border border-border"
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          controls={false}
          onError={(e) => {
            const el = e.currentTarget;
            const localSrc = window.location.origin + "/promo/mastercode-promo.mp4";
            // Kalau URL custom (Supabase dll) gagal load, fallback ke lokal
            // biar video tetep muncul alih-alih ikon rusak kayak kemarin.
            if (el.src !== localSrc) el.src = "/promo/mastercode-promo.mp4";
          }}
        />
      </div>

      {collabAccepted.length > 0 && (filterType === "all" || filterType === "collaboration") && (
        <div className="px-4 mt-4">
          <h2 className="text-xs text-gray-400 font-medium mb-2">Collaboration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {collabAccepted.map((c) => (
              <Link
                key={c.id}
                href={`/editor/${c.owner_login}/${c.repo}`}
                className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] transition hover:border-accent"
              >
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  <FaUsers size={11} className="text-accent shrink-0" />
                  <span className="truncate">{c.repo}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">punya {c.owner_login}</p>
                <span className="inline-block mt-3 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                  Collaboration
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!githubConnected && (filterType === "all" || filterType === "repository") && (
        <div className="mx-4 mt-4 bg-panel border border-border rounded-xl p-5 text-center">
          <FaGithub size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium mb-1">Connect GitHub buat lihat Project kamu</p>
          <p className="text-xs text-gray-500 mb-4">
            Project (Repository &amp; Collaboration) butuh akun GitHub yang terhubung.
          </p>
          <button
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="bg-white text-black text-sm font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2"
          >
            <FaGithub size={14} /> Connect GitHub
          </button>
        </div>
      )}

      {githubConnected && (filterType === "all" || filterType === "repository") && (
        <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-panel border border-border animate-pulse"
              />
            ))}

          {!loading &&
            filtered.map((repo) => (
              <Link
                key={repo.id}
                href={`/editor/${repo.owner.login}/${repo.name}`}
                className="block bg-panel border border-border rounded-xl p-4 active:scale-[0.98] transition hover:border-accent"
              >
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  {repo.private ? (
                    <FaLock size={11} className="text-yellow-500 shrink-0" />
                  ) : (
                    <FaGlobe size={11} className="text-green-500 shrink-0" />
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
                    <FaCodeBranch size={10} />
                  </span>
                  <span className="ml-auto text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                    Repository
                  </span>
                </div>
              </Link>
            ))}

          {!loading && filtered.length === 0 && (
            <p className="col-span-full text-center text-gray-500 text-sm mt-10">
              {t("dashboard.emptyRepos")}
            </p>
          )}
        </div>
      )}

      {/* Iklan: Native Banner, ngikutin tema (paling gak keliatan kayak
         iklan dibanding format lain) — ditaro di antara list project & akhir
         halaman biar kebaca natural, gak dipaksa masuk ke tengah grid. */}
      {githubConnected && !loading && filtered.length > 0 && (filterType === "all" || filterType === "repository") && (
        <div className="px-4 mt-4">
          <AdSlot variant="native" />
        </div>
      )}

      <div className="px-4 mt-6 flex justify-center">
        <AdSlot variant="300x250" />
      </div>

      {showNew && (
        <NewRepoModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            loadRepos();
          }}
        />
      )}
    </main>
  );
}
