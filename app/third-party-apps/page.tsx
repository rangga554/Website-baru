"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaCheckCircle, FaExclamationTriangle, FaPlug, FaTimes, FaSpinner, FaKey, FaCube, FaChevronRight } from "react-icons/fa";
import { SiVercel, SiNetlify, SiRoblox } from "react-icons/si";

type ProviderState = {
  connected: boolean;
  account?: { email: string | null; name: string | null };
  projects?: any[]; // Vercel
  sites?: any[]; // Netlify
  error?: string;
  errorStatus?: number;
};

// Halaman "Aplikasi Pihak Ketiga" — connect akun Vercel/Netlify MASING-
// MASING user, TERPISAH dari akun KRYNOS sendiri.
//   - Vercel: pakai Personal Access Token (user generate sendiri dari
//     vercel.com/account/tokens, tempel ke sini). KRYNOS otomatis
//     validasi token itu + cek izinnya BENERAN cukup buat akses project
//     sebelum disimpan — kalau kurang, ditolak dengan alasan yang jelas.
//   - Netlify: pakai OAuth App resmi (tombol Connect, login lewat halaman
//     Netlify beneran).
// Setelah connect, Dashboard otomatis nambah tab filter sesuai provider
// yang di-connect (lihat app/dashboard/page.tsx).
export default function ThirdPartyAppsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-10 flex items-center gap-2 text-sm text-gray-400 justify-center">
          Memuat...
        </div>
      }
    >
      <ThirdPartyAppsContent />
    </Suspense>
  );
}

// useSearchParams() WAJIB dipake di dalam komponen yang dibungkus <Suspense>
// (aturan Next.js App Router) — makanya logic utamanya dipisah ke sini,
// bukan langsung di default export.
function ThirdPartyAppsContent() {
  const searchParams = useSearchParams();
  const [vercel, setVercel] = useState<ProviderState | null>(null);
  const [netlify, setNetlify] = useState<ProviderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<"vercel" | "netlify" | null>(null);

  const netlifyResult = searchParams.get("netlify");
  const resultMsg = searchParams.get("msg");

  async function loadStatus() {
    setLoading(true);
    const [v, n] = await Promise.all([
      fetch("/api/vercel-connect/status").then((r) => r.json()).catch(() => ({ connected: false })),
      fetch("/api/netlify-connect/status").then((r) => r.json()).catch(() => ({ connected: false })),
    ]);
    setVercel(v);
    setNetlify(n);
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function disconnect(provider: "vercel" | "netlify") {
    if (!confirm(`Putuskan koneksi akun ${provider === "vercel" ? "Vercel" : "Netlify"}? Tab filter terkait di Dashboard juga akan hilang.`)) return;
    setDisconnecting(provider);
    try {
      await fetch(`/api/${provider}-connect/disconnect`, { method: "POST" });
      await loadStatus();
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Aplikasi Pihak Ketiga</h1>
      <p className="text-sm text-gray-400 mb-6">
        Hubungkan akun Vercel/Netlify kamu SENDIRI ke KRYNOS — bukan
        akun siapapun yang lain.
      </p>

      {netlifyResult && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm flex items-start gap-2 ${
            netlifyResult === "connected"
              ? "border-green-600/40 bg-green-600/10 text-green-400"
              : "border-red-600/40 bg-red-600/10 text-red-400"
          }`}
        >
          {netlifyResult === "connected" ? (
            <FaCheckCircle className="mt-0.5 shrink-0" />
          ) : (
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
          )}
          <span>
            {netlifyResult === "connected" && "Akun Netlify berhasil terhubung."}
            {netlifyResult === "error" && (resultMsg || "Gagal menghubungkan akun Netlify.")}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-10 justify-center">
          <FaSpinner className="animate-spin" /> Memuat status koneksi...
        </div>
      ) : (
        <div className="space-y-4">
          <VercelCard state={vercel} onChanged={loadStatus} onDisconnect={() => disconnect("vercel")} disconnecting={disconnecting === "vercel"} />

          <ProviderCard
            name="Netlify"
            icon={<SiNetlify size={20} />}
            state={netlify}
            connectHref="/api/netlify-connect/authorize"
            onDisconnect={() => disconnect("netlify")}
            onChanged={loadStatus}
            disconnecting={disconnecting === "netlify"}
            createEndpoint="/api/netlify-connect/create-site"
            createLabel="Bikin Site Baru"
            renderItems={(s) =>
              (s.sites || []).map((site: any) => (
                <li key={site.id}>
                  <Link href={`/third-party-apps/netlify/${site.id}`} className="flex items-center justify-between py-1.5 text-sm hover:text-accent">
                    <span className="truncate">{site.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{site.state || "-"}</span>
                  </Link>
                </li>
              ))
            }
          />

          <RobloxCard />
        </div>
      )}

      <p className="text-xs text-gray-600 mt-6">
        Halaman ini cuma ngatur koneksi akunnya. Buat set Environment
        Variable, cek deployment, create new project, dll — masuk lewat
        project yang bersangkutan.
      </p>
    </div>
  );
}

function VercelCard({
  state,
  onChanged,
  onDisconnect,
  disconnecting,
}: {
  state: ProviderState | null;
  onChanged: () => void;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const connected = state?.connected;
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function submitToken() {
    if (!token.trim()) {
      setFormError("Token gak boleh kosong");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/vercel-connect/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, teamId: teamId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Gagal menghubungkan token");
        return;
      }
      setToken("");
      setTeamId("");
      setShowForm(false);
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <SiVercel size={20} />
          <span className="font-medium text-sm">Vercel</span>
          {connected && !state?.error && (
            <span className="text-[10px] bg-green-600/15 text-green-400 px-1.5 py-0.5 rounded-full">Terhubung</span>
          )}
          {connected && state?.error && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">Bermasalah</span>
          )}
        </div>

        {connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 disabled:opacity-50"
          >
            {disconnecting ? <FaSpinner className="animate-spin" size={11} /> : <FaTimes size={11} />}
            Putuskan
          </button>
        ) : !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs bg-accent text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:opacity-90"
          >
            <FaKey size={11} />
            Hubungkan
          </button>
        ) : null}
      </div>

      {connected && state?.account && (state.account.email || state.account.name) && (
        <p className="text-xs text-gray-500 mt-2">
          {state.account.name || state.account.email}
          {state.account.name && state.account.email ? ` · ${state.account.email}` : ""}
        </p>
      )}

      {connected && state?.error && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
          <p className="font-medium mb-0.5">Akun kamu lagi kenapa-napa:</p>
          <p className="text-amber-200/90">{state.error}</p>
          <p className="mt-1 text-amber-200/70">Coba Putuskan lalu hubungkan ulang pakai token baru.</p>
        </div>
      )}

      {connected && !state?.error && (
        <ul className="mt-3 divide-y divide-border/60 max-h-56 overflow-y-auto">
          {(state?.projects || []).map((p: any) => (
            <li key={p.id}>
              <Link href={`/third-party-apps/vercel/${p.id}`} className="flex items-center justify-between py-1.5 text-sm hover:text-accent">
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-gray-500 shrink-0">{p.targets?.production ? "Production aktif" : "Belum ada deploy"}</span>
              </Link>
            </li>
          ))}
          {(state?.projects || []).length === 0 && (
            <p className="text-xs text-gray-500 py-2">Belum ada project di akun ini.</p>
          )}
        </ul>
      )}

      {connected && !state?.error && <NewProjectForm onCreated={onChanged} />}

      {!connected && !showForm && (
        <p className="text-xs text-gray-500 mt-2">
          Belum terhubung. Klik Hubungkan buat tempel Personal Access Token dari akun Vercel kamu.
        </p>
      )}

      {!connected && showForm && (
        <div className="mt-3 space-y-2.5">
          <div className="text-xs text-gray-400 bg-black/20 rounded-lg p-2.5 space-y-1">
            <p className="text-gray-300 font-medium mb-1">Cara ambil token:</p>
            <p>1. Login ke <span className="text-gray-200">vercel.com</span></p>
            <p>2. Klik foto profil (kanan atas) → <span className="text-gray-200">Settings</span></p>
            <p>3. Di sidebar kiri, klik <span className="text-gray-200">Tokens</span></p>
            <p>4. Klik <span className="text-gray-200">Create Token</span> → kasih nama bebas → Scope pilih <span className="text-gray-200">Full Account</span> (atau salah satu Team, terus isi Team ID di bawah)</p>
            <p>5. Klik <span className="text-gray-200">Create</span> → token muncul CUMA SEKALI, langsung copy</p>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Tempel Personal Access Token Vercel..."
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="Team ID (opsional, kosongin kalau akun personal)"
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {formError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{formError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={submitToken}
              disabled={submitting}
              className="flex-1 bg-accent text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <FaSpinner className="animate-spin" size={12} /> : <FaKey size={12} />}
              {submitting ? "Memvalidasi token..." : "Hubungkan"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="px-3 text-sm text-gray-400 hover:text-white"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Form "Bikin Project/Site Baru" — generik, dipake Vercel & Netlify (endpoint
// beda, tapi UX-nya sama: nama doang).
// ----------------------------------------------------------------------------
function NewProjectForm({
  onCreated,
  endpoint = "/api/vercel-connect/create-project",
  label = "Bikin Project Baru",
}: {
  onCreated: () => void;
  endpoint?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat");
        return;
      }
      setName("");
      setOpen(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-accent mt-3 flex items-center gap-1.5">
        + {label}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="nama-project-baru"
        className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="flex-1 bg-accent text-white text-sm py-1.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? <FaSpinner className="animate-spin" size={11} /> : null}
          Buat
        </button>
        <button onClick={() => setOpen(false)} className="px-3 text-sm text-gray-400">
          Batal
        </button>
      </div>
    </div>
  );
}

function ProviderCard({
  name,
  icon,
  state,
  connectHref,
  onDisconnect,
  onChanged,
  disconnecting,
  renderItems,
  createEndpoint,
  createLabel,
}: {
  name: string;
  icon: React.ReactNode;
  state: ProviderState | null;
  connectHref: string;
  onDisconnect: () => void;
  onChanged: () => void;
  disconnecting: boolean;
  renderItems: (s: ProviderState) => React.ReactNode;
  createEndpoint: string;
  createLabel: string;
}) {
  const connected = state?.connected;
  const items = connected ? renderItems(state!) : null;
  const itemCount = connected ? (state?.projects || state?.sites || []).length : 0;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="font-medium text-sm">{name}</span>
          {connected && !state?.error && (
            <span className="text-[10px] bg-green-600/15 text-green-400 px-1.5 py-0.5 rounded-full">
              Terhubung
            </span>
          )}
          {connected && state?.error && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">
              Bermasalah
            </span>
          )}
        </div>

        {connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 disabled:opacity-50"
          >
            {disconnecting ? <FaSpinner className="animate-spin" size={11} /> : <FaTimes size={11} />}
            Putuskan
          </button>
        ) : (
          <a
            href={connectHref}
            className="text-xs bg-accent text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:opacity-90"
          >
            <FaPlug size={11} />
            Connect
          </a>
        )}
      </div>

      {connected && state?.account && (state.account.email || state.account.name) && (
        <p className="text-xs text-gray-500 mt-2">
          {state.account.name || state.account.email}
          {state.account.name && state.account.email ? ` · ${state.account.email}` : ""}
        </p>
      )}

      {connected && state?.error && (
        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-300">
          <p className="font-medium mb-0.5">Akun kamu lagi kenapa-napa:</p>
          <p className="text-amber-200/90">{state.error}</p>
          {state.errorStatus === 401 || state.errorStatus === 403 ? (
            <p className="mt-1 text-amber-200/70">
              Kemungkinan token udah dicabut dari sisi {name} — coba Putuskan lalu Connect ulang.
            </p>
          ) : null}
        </div>
      )}

      {connected && !state?.error && (
        <ul className="mt-3 divide-y divide-border/60 max-h-56 overflow-y-auto">
          {items}
          {itemCount === 0 && <p className="text-xs text-gray-500 py-2">Belum ada project/site di akun ini.</p>}
        </ul>
      )}

      {connected && !state?.error && (
        <NewProjectForm onCreated={onChanged} endpoint={createEndpoint} label={createLabel} />
      )}

      {!connected && (
        <p className="text-xs text-gray-500 mt-2">
          Belum terhubung. Klik Connect buat login pakai akun {name} kamu sendiri.
        </p>
      )}
    </div>
  );
}

// Roblox punya alur navigasi bertingkat sendiri (Universe -> Place ->
// Script Explorer), jadi kartu ini cuma ringkasan status + tautan ke
// /third-party-apps/roblox, bukan expand di tempat kayak Vercel/Netlify.
function RobloxCard() {
  const [state, setState] = useState<{ connected: boolean; account?: { name: string }; universes?: any[]; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/roblox-connect/status")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ connected: false }));
  }, []);

  return (
    <Link
      href="/third-party-apps/roblox"
      className="block rounded-xl border border-border/60 bg-surface/40 p-4 hover:border-white/25 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <SiRoblox size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Roblox</div>
          <div className="text-xs text-gray-500 truncate">
            {!state ? "Memuat..." : state.connected ? `Terhubung sebagai ${state.account?.name} · ${state.universes?.length ?? 0} Universe` : "Belum terhubung — pakai cookie .ROBLOSECURITY"}
          </div>
        </div>
        <FaChevronRight className="text-gray-500 shrink-0" size={12} />
      </div>
    </Link>
  );
}
