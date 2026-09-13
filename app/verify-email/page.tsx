"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaEnvelopeOpenText, FaSignOutAlt } from "react-icons/fa";
import AppLogo from "@/components/AppLogo";

function VerifyEmailContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connectEmail, setConnectEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Status ASLI dari database (bukan dari session/JWT yang bisa telat
  // ke-refresh) — dipakai buat nentuin form mana yang ditampilin: kalau
  // akun GitHub belum ada email SAMA SEKALI, wajib isi email dulu; kalau
  // udah ada email (tapi belum verified), langsung ke form kode.
  const [statusLoading, setStatusLoading] = useState(true);
  const [freshStatus, setFreshStatus] = useState<{
    accountType: "local" | "github";
    email: string | null;
    emailVerified: boolean;
    hasEmail: boolean;
  } | null>(null);

  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/auth/verify-status");
      if (res.ok) setFreshStatus(await res.json());
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const linkStatus = searchParams.get("status"); // dari klik link di email
  const linkMsg = searchParams.get("msg");

  useEffect(() => {
    if (status !== "authenticated") return;
    if ((session as any).emailVerified) {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (freshStatus?.emailVerified) {
      router.replace("/dashboard");
    }
  }, [freshStatus, router]);

  useEffect(() => {
    if (linkStatus === "success") {
      setNotice("Email berhasil diverifikasi! Menyegarkan sesi...");
      update().then(() => router.replace("/dashboard"));
    } else if (linkStatus === "error") {
      setError(linkMsg || "Verifikasi gagal.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkStatus]);

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  const accountType = freshStatus?.accountType || (session as any)?.accountType;
  const hasEmail = !!freshStatus?.hasEmail;
  const targetType = accountType === "local" ? "local" : "github";
  const targetId = accountType === "local" ? (session as any)?.localId : (session as any)?.login;

  async function connectEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/connect-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: connectEmail }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Gagal hubungkan email.");
      return;
    }
    setNotice(data.emailSent ? "Kode verifikasi udah dikirim ke email kamu." : "Email tersimpan, tapi pengiriman kode gagal — coba \"Kirim ulang\".");
    await refreshStatus();
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Kode salah.");
      return;
    }
    setNotice("Email berhasil diverifikasi!");
    await update();
    router.replace("/dashboard");
  }

  async function resend() {
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Gagal kirim ulang.");
      return;
    }
    setNotice(data.emailSent ? "Kode baru udah dikirim." : "Kode dibuat, tapi pengiriman email gagal.");
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm text-center">
        <AppLogo size="w-16 h-16" rounded="rounded-2xl" badgeSize="w-6 h-6 text-lg" className="mx-auto mb-4" />
        <FaEnvelopeOpenText className="mx-auto text-accent mb-3" size={28} />
        <h1 className="text-xl font-bold mb-1.5">Verifikasi Email</h1>
        <p className="text-sm text-gray-400 mb-5">
          {accountType === "github"
            ? "Akun GitHub kamu perlu email terverifikasi sebelum bisa pakai KRYNOS."
            : "Cek inbox (atau folder spam) buat kode verifikasi 6 digit."}
        </p>

        {error && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-lg p-3 mb-3 text-left">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-accent bg-accent/10 rounded-lg p-3 mb-3 text-left">{notice}</p>
        )}

        {statusLoading ? (
          <p className="text-sm text-gray-500 py-6">Memuat status akun...</p>
        ) : accountType === "github" && !hasEmail ? (
          <form onSubmit={connectEmailSubmit} className="space-y-3 text-left">
            <input
              type="email"
              value={connectEmail}
              onChange={(e) => setConnectEmail(e.target.value)}
              placeholder="Email kamu"
              required
              className="w-full bg-panel border border-border rounded-xl px-3 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm disabled:opacity-50"
            >
              {loading ? "Mengirim..." : "Kirim Kode Verifikasi"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3 text-left">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Kode 6 digit"
              inputMode="numeric"
              required
              className="w-full bg-panel border border-border rounded-xl px-3 py-3 text-sm text-center tracking-[6px] font-semibold outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-accent font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm disabled:opacity-50"
            >
              {loading ? "Memverifikasi..." : "Verifikasi"}
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={loading}
              className="w-full text-xs text-accent underline"
            >
              Kirim ulang kode
            </button>
          </form>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-red-400 mx-auto"
        >
          <FaSignOutAlt size={11} /> Keluar & login akun lain
        </button>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
