"use client";

import { useState } from "react";
import Link from "next/link";
import { FaEnvelope, FaCheckCircle } from "react-icons/fa";
import AppLogo from "@/components/AppLogo";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim link reset");
      setDone(true);
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

        {done ? (
          <>
            <FaCheckCircle className="text-4xl text-accent mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-2">Cek email kamu</h1>
            <p className="text-sm text-gray-400 mb-6">
              Kalau akun dengan username/email itu ada, link reset password udah dikirim.
              Cek inbox (atau folder spam) kamu.
            </p>
            <Link href="/login" className="text-accent underline text-sm">
              Kembali ke login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-1">Lupa Password</h1>
            <p className="text-sm text-gray-400 mb-6">
              Masukin username atau email akun kamu, nanti dikirimin link buat bikin password baru.
            </p>

            <form onSubmit={submit} className="space-y-3 text-left">
              {error && (
                <p className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3">
                  {error}
                </p>
              )}
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Username atau email"
                  required
                  className="w-full bg-panel border border-border rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-base disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Kirim Link Reset"}
              </button>
              <p className="text-xs text-gray-500 text-center">
                <Link href="/login" className="text-accent underline">
                  Kembali ke login
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
