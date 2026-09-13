"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { FaGithub, FaUserSecret, FaExclamationTriangle } from "react-icons/fa";
import AppLogo from "@/components/AppLogo";

// Login username/password & Passkey UDAH DIHAPUS (lihat lib/auth.ts) — akun
// lokal lama TETAP ADA datanya di database, tapi gak bisa dipakai login
// lagi lewat sini. Satu-satunya cara login "beneran" sekarang GitHub OAuth.
// Yang belum/gak mau login GitHub bisa lanjut sebagai Guest (lihat
// middleware.ts) — Guest cuma bisa liat-liat, gak bisa connect/simpan
// apapun (dicek di masing-masing API route yang butuh session asli).
function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm sm:max-w-md text-center">
        <div className="mb-8">
          <AppLogo
            size="w-20 h-20 sm:w-24 sm:h-24"
            rounded="rounded-2xl"
            badgeSize="w-7 h-7 sm:w-8 sm:h-8 text-xl"
            className="mx-auto mb-3"
          />
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Master <span className="text-accent">Code</span>
          </h1>
        </div>

        {error === "AccessDenied" && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3 mb-4">
            Akun GitHub ini tidak diizinkan mengakses aplikasi ini (mungkin diblokir owner).
          </p>
        )}

        <div className="text-left bg-yellow-950/30 border border-yellow-900/60 rounded-xl p-3.5 mb-5 flex gap-2.5">
          <FaExclamationTriangle className="text-yellow-500 shrink-0 mt-0.5" size={15} />
          <p className="text-xs text-yellow-200/90 leading-relaxed">
            Login pakai username/password & Passkey udah gak bisa dipakai lagi. Kalau kamu punya akun lama, silakan lanjut sebagai <b>Guest</b> dulu, atau login pakai <b>GitHub</b> (kalau akun lokal kamu pernah ditautkan ke GitHub, fitur-fiturnya tetap bisa jalan).
          </p>
        </div>

        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-medium py-3 rounded-xl active:scale-[0.98] transition text-base"
        >
          <FaGithub size={20} />
          Login with GitHub
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-3 w-full flex items-center justify-center gap-2.5 border border-border text-gray-300 font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm"
        >
          <FaUserSecret size={16} />
          Kembali jadi Guest
        </button>

        <p className="mt-6 text-xs text-gray-500 leading-relaxed">
          Login pakai GitHub berarti kamu setuju sama{" "}
          <a href="/privacy" className="text-accent underline">
            Kebijakan Privasi
          </a>{" "}
          kami — ringkasnya: token GitHub kamu disimpan aman di server (bukan cuma browser) buat ngejalanin fitur app ini, gak pernah dijual/dibagi ke pengiklan.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
