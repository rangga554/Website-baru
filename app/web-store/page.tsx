"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FaArrowLeft, FaStore, FaPlus, FaTimes } from "react-icons/fa";
import WebStoreCard, { WebStoreSite } from "@/components/WebStoreCard";
import { useLivePolling } from "@/lib/useLivePolling";

function RegisterModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!url.trim()) return setError("URL wajib diisi");
    setSaving(true);
    try {
      const res = await fetch("/api/web-store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan website");
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-8">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl my-auto flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-bold">Daftarkan Website</h2>
          <button onClick={onClose} className="text-gray-400 p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Masukin URL website-nya aja, gak perlu isi apa-apa lagi. AI bakal langsung ngecek
            seberapa aman website ini buat data pengguna (HTTPS, form login, kebijakan privasi,
            dll), dan otomatis dicek ulang tiap hari.
          </p>
          <div>
            <label className="text-xs text-gray-400 block mb-1">URL Website</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="contoh.com atau https://contoh.com"
              className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none"
              disabled={saving}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-accent rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Mengecek website..." : "Daftarkan & Cek Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebStorePage() {
  const { data: session } = useSession();
  const login = (session as any)?.login as string | undefined;

  const [sites, setSites] = useState<WebStoreSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  async function load() {
    const res = await fetch("/api/web-store");
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // List Web Store auto-update tiap 5 detik, tanpa reload halaman.
  useLivePolling(load, 5000, true);

  function handleRescanned(updated: WebStoreSite) {
    setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border bg-panel sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
            <FaArrowLeft size={16} />
          </Link>
          <h1 className="font-bold flex items-center gap-2">
            <FaStore className="text-accent" /> Web Store
          </h1>
        </div>
        {login && (
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 bg-accent rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <FaPlus size={11} /> Daftarkan
          </button>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Daftar website yang udah dicek AI buat keamanan data penggunanya. Website terdaftar
          otomatis dicek ulang tiap hari, jadi statusnya selalu ter-update.
        </p>

        <div className="space-y-3">
          {loading && <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>}
          {!loading && sites.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">
              Belum ada website yang terdaftar. Jadi yang pertama daftarin!
            </p>
          )}
          {sites.map((site) => (
            <WebStoreCard
              key={site.id}
              site={site}
              isOwner={site.owner_login === login}
              onRescanned={handleRescanned}
            />
          ))}
        </div>
      </div>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onCreated={load} />}
    </main>
  );
}
