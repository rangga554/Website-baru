"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaCode, FaGithub, FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import AppLogo from "@/components/AppLogo";
import { useRole } from "@/lib/useRole";

export default function DevPanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const login = (session as any)?.login as string | undefined;
  const role = useRole(login);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !role.loading && !role.isDeveloper && !role.isOwner) {
      router.replace("/dashboard");
    }
  }, [status, role.loading, role.isDeveloper, role.isOwner, router]);

  if (status !== "authenticated" || role.loading || (!role.isDeveloper && !role.isOwner)) return null;

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <AppLogo />
            <FaCode className="text-fuchsia-400" /> Dev Panel
          </h1>
          <Link href="/dashboard" className="text-xs text-gray-400 underline flex items-center gap-1">
            <FaArrowLeft size={10} /> Kembali
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5">
          <p className="text-xs text-fuchsia-300 font-semibold mb-1">AKSES DEVELOPER</p>
          <h2 className="text-xl font-bold mb-1">Halo, {login}</h2>
          <p className="text-sm text-gray-400">Akun GitHub ini sudah diberi role Developer oleh Owner.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/search" className="rounded-xl border border-border bg-panel p-4 hover:border-fuchsia-400/50 transition">
            <FaGithub className="text-fuchsia-400 mb-2" />
            <p className="font-semibold text-sm">GitHub Project</p>
            <p className="text-xs text-gray-500 mt-1">Cari dan buka repository GitHub.</p>
          </Link>
          <a href={`https://github.com/${login}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-panel p-4 hover:border-fuchsia-400/50 transition">
            <FaExternalLinkAlt className="text-fuchsia-400 mb-2" />
            <p className="font-semibold text-sm">Profil GitHub</p>
            <p className="text-xs text-gray-500 mt-1">Buka profil GitHub kamu.</p>
          </a>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="font-semibold text-sm mb-2">Status Role</p>
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-md bg-fuchsia-500/10 text-fuchsia-300">DEV 🧑‍💻</span>
            {role.isOwner && <span className="px-2 py-1 rounded-md bg-sky-500/10 text-sky-300">OWNER</span>}
          </div>
        </div>
      </div>
    </main>
  );
}
