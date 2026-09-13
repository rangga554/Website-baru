import Link from "next/link";
import { FaCodeBranch, FaBolt, FaMobileAlt } from "react-icons/fa";
import type { Metadata } from "next";
import AppLogo from "@/components/AppLogo";

export const metadata: Metadata = {
  title: "KRYNOS — Editor GitHub dari Browser",
  description:
    "Edit, commit, branch, dan release repository GitHub kamu langsung dari browser — di HP atau laptop, sama enaknya.",
};

// Landing page ini SENGAJA gak baca session sama sekali di sini (beda dari
// sebelumnya) — biar halaman ini bisa di-generate STATIS (dapet ETag,
// bisa di-cache CDN Vercel, load-nya jauh lebih cepat buat visitor baru/
// Googlebot). Redirect buat user yang UDAH login ke /dashboard ditangani
// di middleware.ts sebelum request ini sampai ke sini.
export default function Home() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4 py-12">
      <div className="w-full max-w-sm sm:max-w-md text-center">
        <AppLogo
          size="w-20 h-20 sm:w-24 sm:h-24"
          rounded="rounded-2xl"
          badgeSize="w-7 h-7 sm:w-8 sm:h-8 text-xl"
          className="mx-auto mb-3"
        />
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Master<span className="text-accent">Code</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-400">
          Editor GitHub lengkap, langsung dari browser. Edit, commit, branch,
          release — di HP atau di laptop, sama enaknya.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 text-left">
          <div className="flex items-center gap-3 bg-panel border border-border rounded-xl p-3">
            <FaMobileAlt className="text-accent shrink-0" size={18} />
            <span className="text-sm text-gray-300">
              Ngoding & commit langsung dari HP, tanpa perlu laptop
            </span>
          </div>
          <div className="flex items-center gap-3 bg-panel border border-border rounded-xl p-3">
            <FaCodeBranch className="text-accent shrink-0" size={18} />
            <span className="text-sm text-gray-300">
              Kelola branch, commit, dan release repository GitHub kamu
            </span>
          </div>
          <div className="flex items-center gap-3 bg-panel border border-border rounded-xl p-3">
            <FaBolt className="text-accent shrink-0" size={18} />
            <span className="text-sm text-gray-300">
              Live preview deployment & test workflow tanpa keluar app
            </span>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-8 w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 rounded-xl active:scale-[0.98] transition text-base"
        >
          Mulai Berkreasi!
        </Link>

        <p className="mt-6 text-xs text-gray-500">
          Kami hanya menyimpan token sesi di browser kamu. Tidak ada data
          repository yang disimpan di server kami.
        </p>
      </div>
    </main>
  );
}
