"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FaLock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import AppLogo from "@/components/AppLogo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setValid(!!d.valid))
      .finally(() => setChecking(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Konfirmasi password gak sama.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal reset password");
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm text-center">
        <AppLogo size="w-14 h-14" rounded="rounded-xl" badgeSize="w-5 h-5 text-[10px]" className="mx-auto mb-4" />

        {checking ? (
          <p className="text-sm text-gray-500">Memeriksa link reset...</p>
        ) : done ? (
          <>
            <FaCheckCircle className="text-4xl text-accent mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-2">Password berhasil diganti!</h1>
            <p className="text-sm text-gray-400">Ngarahin ke halaman login...</p>
          </>
        ) : !valid ? (
          <>
            <FaTimesCircle className="text-4xl text-red-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-2">Link Gak Valid</h1>
            <p className="text-sm text-gray-400 mb-6">
              Link reset ini udah kedaluwarsa atau udah pernah kepakai. Minta link baru ya.
            </p>
            <Link href="/forgot-password" className="text-accent underline text-sm">
              Minta link reset baru
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-1">Bikin Password Baru</h1>
            <p className="text-sm text-gray-400 mb-6">Masukin password baru buat akun kamu.</p>

            <form onSubmit={submit} className="space-y-3 text-left">
              {error && (
                <p className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3">
                  {error}
                </p>
              )}
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password baru (min. 8 karakter)"
                  required
                  className="w-full bg-panel border border-border rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  className="w-full bg-panel border border-border rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-base disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
