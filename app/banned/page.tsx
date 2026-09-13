"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaBan, FaComments, FaSignOutAlt, FaInfoCircle } from "react-icons/fa";
import { OWNER_LOGIN } from "@/lib/owner";

type BanStatus = { banned: boolean; reason: string | null; bannedAt: string | null };

export default function BannedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [info, setInfo] = useState<BanStatus | null>(null);
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState("");

  const login = (session as any)?.login as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me/status")
      .then((r) => r.json())
      .then((d: BanStatus) => {
        // Ternyata udah di-unban (owner buka blokirnya) -> balik ke dashboard
        // normal, gak perlu nyangkut di halaman ini.
        if (!d.banned) {
          router.replace("/dashboard");
          return;
        }
        setInfo(d);
      })
      .catch(() => {});
  }, [status, router]);

  if (status !== "authenticated" || !info) return null;

  // Kontak banding SEKARANG lewat fitur Message internal (chat ke Owner),
  // BUKAN lagi WhatsApp — biar riwayat percakapan bandingnya kesimpen &
  // Owner bisa balas langsung dari dalam app. Selalu diarahkan ke Owner
  // (bukan admin sembarangan) karena Owner itu otoritas final buat kasus
  // ban/banding, dan Owner dijamin selalu ada (beda dari admin yang bisa
  // berubah-ubah).
  async function contactOwner() {
    setContacting(true);
    setContactError("");
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetLogin: OWNER_LOGIN }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuka chat");
      router.push(`/messages/${data.conversation.id}`);
    } catch (e: any) {
      setContactError(e.message);
      setContacting(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm sm:max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <FaBan size={28} className="text-red-400" />
        </div>

        <h1 className="text-xl font-bold mb-1">Akun Kamu Diblokir</h1>
        <p className="text-sm text-gray-400 mb-6">
          Akun <span className="text-gray-300 font-medium">{login}</span> gak bisa
          dipakai buat sementara oleh owner KRYNOS.
        </p>

        <div className="rounded-xl border border-border bg-panel p-4 text-left mb-3">
          <p className="text-xs text-gray-400 flex items-center gap-1.5 mb-1.5">
            <FaInfoCircle size={11} /> Alasan
          </p>
          <p className="text-sm">
            {info.reason || "Tidak ada alasan spesifik yang dicantumkan owner."}
          </p>
          {info.bannedAt && (
            <p className="text-[11px] text-gray-500 mt-2">
              Diblokir sejak {new Date(info.bannedAt).toLocaleString("id-ID")}
            </p>
          )}
        </div>

        <button
          onClick={contactOwner}
          disabled={contacting}
          className="w-full flex items-center justify-center gap-2.5 bg-accent text-white font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm mb-2.5 disabled:opacity-50"
        >
          <FaComments size={16} />
          {contacting ? "Membuka chat..." : "Chat Owner buat Banding"}
        </button>
        {contactError && <p className="text-[11px] text-red-400 mb-2.5">{contactError}</p>}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center justify-center gap-2.5 bg-panel border border-border text-gray-300 font-medium py-3 rounded-xl active:scale-[0.98] transition text-sm"
        >
          <FaSignOutAlt size={16} />
          Logout dari Akun Ini
        </button>
      </div>
    </main>
  );
}
