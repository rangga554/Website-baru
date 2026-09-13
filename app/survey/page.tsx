"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaCheckCircle } from "react-icons/fa";

export default function SurveyPage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [reason, setReason] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/survey")
      .then((r) => r.json())
      .then((data) => {
        if (data.answered) {
          setAlreadyAnswered(true);
          setResetAt(data.resetAt);
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  async function submit() {
    setError("");
    if (!reason.trim()) return setError("Saran wajib diisi");

    setSubmitting(true);
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setSubmitting(false);

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDone(true);
    } else {
      setError(data.error || "Gagal mengirim survey");
      if (res.status === 409) setAlreadyAnswered(true);
    }
  }

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
        <h1 className="font-bold text-lg">Kotak Saran</h1>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500 px-4 mt-6">Memuat...</p>
      ) : done ? (
        <div className="px-4 mt-10 flex flex-col items-center text-center gap-3">
          <FaCheckCircle className="text-4xl text-green-400" />
          <p className="font-semibold">Terima kasih atas masukannya!</p>
          <p className="text-sm text-gray-400">
            Saranmu udah kekirim. Kotak saran akan dibuka lagi minggu depan.
          </p>
          <Link
            href="/survey/live"
            className="mt-2 bg-accent text-white font-medium px-5 py-2.5 rounded-lg text-sm"
          >
            Lihat Saran Lainnya
          </Link>
        </div>
      ) : alreadyAnswered ? (
        <div className="px-4 mt-10 flex flex-col items-center text-center gap-3">
          <FaCheckCircle className="text-4xl text-accent" />
          <p className="font-semibold">Kamu sudah kirim saran minggu ini</p>
          <p className="text-sm text-gray-400">
            {resetAt
              ? `Kotak saran akan direset dan bisa diisi lagi mulai ${new Date(
                  resetAt
                ).toLocaleString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : "Coba lagi minggu depan, ya."}
          </p>
          <Link
            href="/survey/live"
            className="mt-2 bg-accent text-white font-medium px-5 py-2.5 rounded-lg text-sm"
          >
            Lihat Saran Lainnya
          </Link>
        </div>
      ) : (
        <div className="px-4 mt-6 flex flex-col gap-6 max-w-lg mx-auto">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Ada saran/masukan buat KRYNOS?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={6}
              placeholder="Tulis saran, ide fitur, atau kritik kamu di sini..."
              className="bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="bg-accent text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Kirim"}
          </button>
        </div>
      )}
    </main>
  );
}
