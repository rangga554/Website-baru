"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaSpinner,
  FaPlay,
  FaTrash,
  FaPlus,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaEye,
  FaEyeSlash,
  FaPen,
  FaSave,
  FaTimes,
  FaGlobe,
  FaStar,
} from "react-icons/fa";
import { SiNetlify } from "react-icons/si";

// Halaman detail 1 site Netlify — env var (lihat/tambah/edit/hapus),
// status deploy, tombol Test (trigger build), dan detail deploy. Beda dari
// Vercel: Netlify balikin VALUE ASLI langsung di list env var (gak perlu
// endpoint "reveal" terpisah) — jadi di sini di-mask di sisi tampilan doang.
export default function NetlifySitePage() {
  const params = useParams();
  const id = params.id as string;

  const [envs, setEnvs] = useState<any[]>([]);
  const [deploys, setDeploys] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [domainVerification, setDomainVerification] = useState<string>("unknown");
  const [domainDnsGuide, setDomainDnsGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const [openDetailFor, setOpenDetailFor] = useState<string | null>(null);
  const [openPreviewFor, setOpenPreviewFor] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    const [envRes, depRes, domRes] = await Promise.all([
      fetch(`/api/netlify-connect/sites/${id}/env`).then((r) => r.json()),
      fetch(`/api/netlify-connect/sites/${id}/deploys`).then((r) => r.json()),
      fetch(`/api/netlify-connect/sites/${id}/domains`).then((r) => r.json()),
    ]);
    if (envRes.error) setError(envRes.error);
    else setEnvs(envRes.envs || []);
    if (depRes.error && !envRes.error) setError(depRes.error);
    else setDeploys(depRes.deploys || []);
    if (!domRes.error) {
      setDomains(domRes.domains || []);
      setDomainVerification(domRes.verification || "unknown");
      setDomainDnsGuide(domRes.dnsGuide || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  async function deleteEnv(key: string) {
    if (!confirm("Hapus environment variable ini?")) return;
    await fetch(`/api/netlify-connect/sites/${id}/env?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    await loadAll();
  }

  async function testBuild() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${id}/build`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTestMsg(`Gagal: ${data.error}`);
        return;
      }
      setTestMsg("Build baru dimulai — refresh daftar deploy sebentar lagi buat liat statusnya.");
      setTimeout(loadAll, 3000);
    } finally {
      setTesting(false);
    }
  }

  async function viewDetail(deployId: string) {
    if (openDetailFor === deployId) {
      setOpenDetailFor(null);
      return;
    }
    setOpenDetailFor(deployId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${id}/deploys/${deployId}`);
      const data = await res.json();
      setDetail(data.deploy || null);
    } finally {
      setDetailLoading(false);
    }
  }

  function statusBadge(state: string) {
    const map: Record<string, { color: string; icon: any }> = {
      ready: { color: "text-green-400 bg-green-500/10", icon: FaCheckCircle },
      error: { color: "text-red-400 bg-red-500/10", icon: FaExclamationTriangle },
      building: { color: "text-amber-400 bg-amber-500/10", icon: FaClock },
      enqueued: { color: "text-gray-400 bg-gray-500/10", icon: FaClock },
      new: { color: "text-gray-400 bg-gray-500/10", icon: FaClock },
    };
    const cfg = map[state] || map.new;
    const Icon = cfg.icon;
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium ${cfg.color}`}>
        <Icon size={9} /> {state}
      </span>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/third-party-apps" className="text-xs text-gray-400 flex items-center gap-1.5 mb-4 hover:text-gray-200 w-fit">
        <FaArrowLeft size={10} /> Aplikasi Pihak Ketiga
      </Link>
      <div className="flex items-center gap-2 mb-6">
        <SiNetlify size={18} />
        <h1 className="text-lg font-semibold">Site Netlify</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-16 justify-center">
          <FaSpinner className="animate-spin" /> Memuat...
        </div>
      ) : error ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-300 flex items-start gap-2.5">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <span>Akun kamu lagi bermasalah: {error}</span>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-200">Deploy</h2>
              <button
                onClick={testBuild}
                disabled={testing}
                className="text-xs bg-accent text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition"
              >
                {testing ? <FaSpinner className="animate-spin" size={11} /> : <FaPlay size={11} />}
                Test (Trigger Build)
              </button>
            </div>
            {testMsg && <p className="text-xs text-gray-400 mb-2.5 bg-black/20 rounded-lg px-3 py-2">{testMsg}</p>}

            <div className="rounded-xl border border-border bg-panel divide-y divide-border/60 overflow-hidden">
              {deploys.length === 0 && <p className="text-xs text-gray-500 p-4">Belum ada deploy.</p>}
              {deploys.map((d: any) => (
                <div key={d.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400 truncate font-mono">{d.deploy_url || d.name}</span>
                    {statusBadge(d.state)}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {d.state === "ready" && d.deploy_url && (
                      <button
                        onClick={() => setOpenPreviewFor(openPreviewFor === d.id ? null : d.id)}
                        className="text-[11px] text-accent hover:underline flex items-center gap-1"
                      >
                        <FaEye size={10} /> {openPreviewFor === d.id ? "Tutup preview" : "Preview"}
                      </button>
                    )}
                    <button onClick={() => viewDetail(d.id)} className="text-[11px] text-accent hover:underline">
                      {openDetailFor === d.id ? "Tutup detail" : "Lihat detail"}
                    </button>
                  </div>
                  {openPreviewFor === d.id && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-border" style={{ height: 420 }}>
                      <iframe
                        src={d.deploy_url}
                        title={`preview-${d.id}`}
                        className="w-full h-full bg-white"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  )}
                  {openDetailFor === d.id && (
                    <div className="mt-2 bg-black/40 rounded-lg p-2.5 max-h-48 overflow-y-auto font-mono text-[10px] text-gray-400 leading-relaxed">
                      {detailLoading ? (
                        <FaSpinner className="animate-spin" />
                      ) : !detail ? (
                        "Gagal memuat detail."
                      ) : detail.error_message ? (
                        <span className="text-red-400">{detail.error_message}</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div>Status: {detail.state}</div>
                          <div>Branch: {detail.branch || "-"}</div>
                          <div>Waktu deploy: {detail.deploy_time ? `${detail.deploy_time}s` : "-"}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Manage Domain */}
          <NetlifyDomainSection
            siteId={id}
            domains={domains}
            verification={domainVerification}
            dnsGuide={domainDnsGuide}
            onChanged={loadAll}
          />

          <EnvVarSection siteId={id} envs={envs} onChanged={loadAll} onDelete={deleteEnv} />
        </div>
      )}
    </div>
  );
}

function EnvVarSection({
  siteId,
  envs,
  onChanged,
  onDelete,
}: {
  siteId: string;
  envs: any[];
  onChanged: () => void;
  onDelete: (key: string) => void;
}) {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  function valueOf(env: any): string {
    // Netlify nyimpen value per-context (production/branch/dll) — kita
    // ambil context "all" kalau ada, kalau enggak ambil yang pertama.
    const values = env.values || [];
    const allCtx = values.find((v: any) => v.context === "all");
    return (allCtx || values[0])?.value ?? "";
  }

  function startEdit(env: any) {
    setEditingKey(env.key);
    setEditValue(valueOf(env));
    setRowError(null);
  }

  async function saveEdit(key: string) {
    setSaving(true);
    setRowError(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${siteId}/env`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value: editValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error || "Gagal menyimpan");
        return;
      }
      setEditingKey(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function addEnv() {
    if (!newKey.trim() || !newValue) {
      setEnvError("Key dan value wajib diisi");
      return;
    }
    setAddingEnv(true);
    setEnvError(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${siteId}/env`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: newKey.trim(), value: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnvError(data.error || "Gagal menambah env var");
        return;
      }
      setNewKey("");
      setNewValue("");
      setAddOpen(false);
      onChanged();
    } finally {
      setAddingEnv(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200">Environment Variables</h2>
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="text-xs text-accent flex items-center gap-1.5 hover:underline"
        >
          <FaPlus size={10} /> Tambah
        </button>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 mb-3 space-y-2.5">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="KEY"
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
          />
          {envError && <p className="text-xs text-red-400">{envError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addEnv}
              disabled={addingEnv}
              className="flex-1 bg-accent text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {addingEnv ? <FaSpinner className="animate-spin" size={12} /> : null}
              Simpan
            </button>
            <button onClick={() => setAddOpen(false)} className="px-3 text-sm text-gray-400 hover:text-white">
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-panel divide-y divide-border/60 overflow-hidden">
        {envs.length === 0 && <p className="text-xs text-gray-500 p-4">Belum ada environment variable.</p>}
        {envs.map((e: any) => {
          const isEditing = editingKey === e.key;
          const isRevealed = revealedKeys[e.key];
          const value = valueOf(e);

          return (
            <div key={e.key} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-mono truncate">{e.key}</p>
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setRevealedKeys((r) => ({ ...r, [e.key]: !r[e.key] }))}
                      className="p-1.5 text-gray-500 hover:text-gray-200"
                      title="Lihat value"
                    >
                      {isRevealed ? <FaEyeSlash size={12} /> : <FaEye size={12} />}
                    </button>
                    <button onClick={() => startEdit(e)} className="p-1.5 text-gray-500 hover:text-accent" title="Edit">
                      <FaPen size={12} />
                    </button>
                    <button onClick={() => onDelete(e.key)} className="p-1.5 text-gray-500 hover:text-red-400" title="Hapus">
                      <FaTrash size={12} />
                    </button>
                  </div>
                )}
              </div>

              {!isEditing && isRevealed && (
                <div className="mt-2 bg-black/30 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 break-all">
                  {value}
                </div>
              )}

              {isEditing && (
                <div className="mt-2.5 space-y-2">
                  <input
                    value={editValue}
                    onChange={(ev) => setEditValue(ev.target.value)}
                    className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
                  />
                  {rowError && <p className="text-xs text-red-400">{rowError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(e.key)}
                      disabled={saving}
                      className="flex-1 bg-accent text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {saving ? <FaSpinner className="animate-spin" size={11} /> : <FaSave size={11} />}
                      Simpan
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="px-3 text-xs text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      <FaTimes size={11} /> Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NetlifyDomainSection({
  siteId,
  domains,
  verification,
  dnsGuide,
  onChanged,
}: {
  siteId: string;
  domains: any[];
  verification: string;
  dnsGuide: any;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyError, setBusyError] = useState<string | null>(null);
  const [openGuideFor, setOpenGuideFor] = useState<string | null>(null);

  async function addDomain() {
    if (!newDomain.trim()) {
      setAddError("Domain wajib diisi");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${siteId}/domains`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Gagal menambah domain");
        return;
      }
      setNewDomain("");
      setAddOpen(false);
      onChanged();
    } finally {
      setAdding(false);
    }
  }

  async function removeDomain(domain: string) {
    if (!confirm(`Hapus domain "${domain}" dari site ini?`)) return;
    setBusy(domain);
    setBusyError(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${siteId}/domains/${encodeURIComponent(domain)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBusyError(data.error || `Gagal menghapus domain "${domain}"`);
        return;
      }
      onChanged();
    } catch {
      setBusyError(`Gagal menghapus domain "${domain}" — cek koneksi kamu`);
    } finally {
      setBusy(null);
    }
  }

  async function makePrimary(domain: string) {
    setBusy(domain);
    setBusyError(null);
    try {
      const res = await fetch(`/api/netlify-connect/sites/${siteId}/domains/${encodeURIComponent(domain)}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBusyError(data.error || `Gagal jadiin "${domain}" primary`);
        return;
      }
      onChanged();
    } catch {
      setBusyError(`Gagal jadiin "${domain}" primary — cek koneksi kamu`);
    } finally {
      setBusy(null);
    }
  }

  function verificationBadge(v: string, clickable: boolean) {
    if (v === "verified")
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium text-green-400 bg-green-500/10">
          <FaCheckCircle size={9} /> Verified (SSL aktif)
        </span>
      );
    if (v === "pending")
      return (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium text-amber-400 bg-amber-500/10 ${
            clickable ? "cursor-pointer hover:bg-amber-500/20" : ""
          }`}
        >
          <FaClock size={9} /> Nunggu DNS/SSL {clickable && "· klik buat lihat cara benerin"}
        </span>
      );
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium text-gray-400 bg-gray-500/10">
        <FaClock size={9} /> Belum diketahui
      </span>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
          <FaGlobe size={12} /> Domain
        </h2>
        <button onClick={() => setAddOpen((v) => !v)} className="text-xs text-accent flex items-center gap-1.5 hover:underline">
          <FaPlus size={10} /> Tambah
        </button>
      </div>

      {addOpen && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 mb-3 space-y-2.5">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="contoh.com"
            className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
          />
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addDomain}
              disabled={adding}
              className="flex-1 bg-accent text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {adding ? <FaSpinner className="animate-spin" size={12} /> : null}
              Tambah
            </button>
            <button onClick={() => setAddOpen(false)} className="px-3 text-sm text-gray-400 hover:text-white">
              Batal
            </button>
          </div>
        </div>
      )}

      {busyError && <p className="text-xs text-red-400 mb-2">{busyError}</p>}

      <div className="rounded-xl border border-border bg-panel divide-y divide-border/60 overflow-hidden">
        {domains.length === 0 && <p className="text-xs text-gray-500 p-4">Belum ada domain custom di site ini.</p>}
        {domains.map((d: any) => {
          const clickable = verification !== "verified";
          return (
            <div key={d.name} className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-mono truncate">{d.name}</p>
                    {d.isPrimary && <FaStar size={10} className="text-amber-400 shrink-0" title="Domain utama" />}
                  </div>
                  <div className="mt-1" onClick={() => clickable && setOpenGuideFor(openGuideFor === d.name ? null : d.name)}>
                    {verificationBadge(verification, clickable)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!d.isPrimary && (
                    <button
                      onClick={() => makePrimary(d.name)}
                      disabled={busy === d.name}
                      className="p-1.5 text-gray-500 hover:text-amber-400 disabled:opacity-40"
                      title="Jadikan domain utama"
                    >
                      <FaStar size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => removeDomain(d.name)}
                    disabled={busy === d.name}
                    className="p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-40"
                    title="Hapus domain"
                  >
                    {busy === d.name ? <FaSpinner className="animate-spin" size={12} /> : <FaTrash size={12} />}
                  </button>
                </div>
              </div>

              {openGuideFor === d.name && dnsGuide && (
                <div className="mt-3 bg-black/30 rounded-lg p-3 text-xs space-y-2.5">
                  <p className="text-gray-300 font-medium">Pilih SALAH SATU cara ini di DNS provider domain-mu:</p>

                  <div>
                    <p className="text-gray-400 mb-1">Opsi 1 — tambah record biasa:</p>
                    <div className="grid grid-cols-3 gap-2 font-mono">
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase">Type</p>
                        <p className="text-gray-200">{dnsGuide.recordType}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase">Host/Name</p>
                        <p className="text-gray-200">{dnsGuide.host}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase">Value</p>
                        <p className="text-gray-200 break-all">{dnsGuide.value}</p>
                      </div>
                    </div>
                  </div>

                  {dnsGuide.nameservers?.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-gray-400 mb-1">
                        Opsi 2 — ganti Nameserver (NS) domain-mu sepenuhnya ke Netlify (lebih simpel, tapi ganti pengaturan DNS lain juga ikut pindah ke Netlify):
                      </p>
                      <div className="font-mono text-gray-200 space-y-0.5">
                        {dnsGuide.nameservers.map((ns: string, i: number) => (
                          <p key={i}>{ns}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-gray-500 pt-1">
                    Propagasi DNS bisa makan waktu sampai 48 jam tergantung provider domain-mu.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
