"use client";

import { useEffect, useState } from "react";
import { FaHistory, FaPlus, FaMinus, FaFileAlt, FaCheckCircle, FaTimesCircle, FaSpinner } from "react-icons/fa";
import DeployLogDebugger from "./DeployLogDebugger";
import CopyContentButton from "./CopyContentButton";

type Provider = "vercel" | "netlify";
type DeployInfo = { sha: string; state: string; url: string; id: string };
const LABEL: Record<Provider, string> = { vercel: "Vercel", netlify: "Netlify" };
const DOT: Record<Provider, string> = { vercel: "bg-white", netlify: "bg-teal-400" };

function DeployBadge({
  provider,
  info,
  onOpenLog,
}: {
  provider: Provider;
  info?: DeployInfo;
  onOpenLog: (provider: Provider, info: DeployInfo) => void;
}) {
  if (!info) return null;
  const dot = <span className={`w-1.5 h-1.5 rounded-full ${DOT[provider]}`} />;

  if (info.state === "READY") {
    return (
      <a
        href={info.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-green-400 text-[10px] shrink-0"
        title={`${LABEL[provider]}: deploy berhasil — buka preview`}
      >
        {dot} <FaCheckCircle size={9} /> Live
      </a>
    );
  }
  if (info.state === "ERROR") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenLog(provider, info);
        }}
        className="flex items-center gap-1 text-red-400 text-[10px] shrink-0 underline decoration-dotted"
        title={`${LABEL[provider]}: lihat log build & analisis AI`}
      >
        {dot} <FaTimesCircle size={9} /> Gagal
      </button>
    );
  }
  if (info.state === "CANCELED") {
    return (
      <span className="flex items-center gap-1 text-gray-500 text-[10px] shrink-0" title={`${LABEL[provider]}: dibatalkan`}>
        {dot} Dibatalkan
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-yellow-400 text-[10px] shrink-0" title={`Lagi build di ${LABEL[provider]}`}>
      {dot} <FaSpinner size={9} className="animate-spin" /> Building
    </span>
  );
}

export default function LogsPanel({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [commits, setCommits] = useState<any[]>([]);
  const [vercelBySha, setVercelBySha] = useState<Record<string, DeployInfo>>({});
  const [netlifyBySha, setNetlifyBySha] = useState<Record<string, DeployInfo>>({});
  const [debugDeploy, setDebugDeploy] = useState<{ provider: Provider; info: DeployInfo } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadDeployStatus() {
    // Vercel & Netlify dimuat paralel & terpisah dari commit — kalau salah
    // satu (atau dua-duanya) belum di-setup/gagal, badge-nya cuma gak
    // muncul, gak ganggu tampilan daftar commit.
    const [vRes, nRes] = await Promise.allSettled([
      fetch(`/api/vercel/deployments?owner=${owner}&repo=${repo}&branch=${encodeURIComponent(branch)}`),
      fetch(`/api/netlify/deployments?owner=${owner}&repo=${repo}&branch=${encodeURIComponent(branch)}`),
    ]);

    if (vRes.status === "fulfilled" && vRes.value.ok) {
      const list: DeployInfo[] = await vRes.value.json();
      const map: Record<string, DeployInfo> = {};
      for (const d of list) map[d.sha] = d;
      setVercelBySha(map);
    }
    if (nRes.status === "fulfilled" && nRes.value.ok) {
      const list: DeployInfo[] = await nRes.value.json();
      const map: Record<string, DeployInfo> = {};
      for (const d of list) map[d.sha] = d;
      setNetlifyBySha(map);
    }
  }

  async function load() {
    setLoading(true);
    setDetail(null);
    const res = await fetch(
      `/api/github/repo/${owner}/${repo}/commits?ref=${encodeURIComponent(branch)}`
    );
    if (res.ok) setCommits(await res.json());
    setLoading(false);

    loadDeployStatus().catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, branch]);

  // Auto-refresh badge status deploy tiap 6 detik selama masih ada yang
  // "Building" di salah satu provider — biar badge-nya otomatis update
  // jadi Live/Gagal tanpa perlu reload manual.
  useEffect(() => {
    const isBuilding = (m: Record<string, DeployInfo>) =>
      Object.values(m).some((d) => !["READY", "ERROR", "CANCELED"].includes(d.state));
    if (!isBuilding(vercelBySha) && !isBuilding(netlifyBySha)) return;

    const interval = setInterval(() => loadDeployStatus().catch(() => {}), 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vercelBySha, netlifyBySha, owner, repo, branch]);

  async function openCommit(sha: string) {
    setLoadingDetail(true);
    setDetail({ sha }); // biar langsung kebuka panel-nya sambil loading
    const res = await fetch(`/api/github/repo/${owner}/${repo}/commits?sha=${sha}`);
    if (res.ok) setDetail(await res.json());
    setLoadingDetail(false);
  }

  if (detail) {
    return (
      <div className="p-4">
        <button onClick={() => setDetail(null)} className="text-xs text-accent mb-3">
          ← Kembali ke daftar log
        </button>

        {loadingDetail || !detail.commit ? (
          <p className="text-sm text-gray-500">Memuat detail perubahan...</p>
        ) : (
          <>
            <p className="text-sm font-medium">{detail.commit.message}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1.5">
              <img src={detail.author?.avatar_url} className="w-5 h-5 rounded-full" />
              {detail.commit.author.name} ·{" "}
              {new Date(detail.commit.author.date).toLocaleString("id-ID")}
            </div>
            <p className="text-[11px] text-gray-600 mt-1 font-mono">{detail.sha?.slice(0, 7)}</p>

            <div className="flex items-center gap-3 mt-3 text-xs">
              <span className="flex items-center gap-1 text-green-400">
                <FaPlus size={9} /> {detail.stats?.additions ?? 0}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <FaMinus size={9} /> {detail.stats?.deletions ?? 0}
              </span>
              <span className="text-gray-500">{detail.files?.length ?? 0} file berubah</span>
            </div>

            <div className="mt-4 space-y-3">
              {detail.files?.map((f: any) => (
                <div key={f.filename} className="bg-panel border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="flex items-center gap-2 text-xs truncate">
                      <FaFileAlt size={10} className="shrink-0 text-gray-400" />
                      <span className="truncate">{f.filename}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] text-gray-500">
                        +{f.additions} -{f.deletions}
                      </span>
                      {f.patch && <CopyContentButton getText={() => f.patch} iconOnly />}
                    </div>
                  </div>
                  {f.patch && (
                    <pre className="text-[11px] p-2 overflow-x-auto whitespace-pre leading-relaxed">
                      {f.patch.split("\n").map((line: string, i: number) => (
                        <div
                          key={i}
                          className={
                            line.startsWith("+") && !line.startsWith("+++")
                              ? "text-green-400"
                              : line.startsWith("-") && !line.startsWith("---")
                              ? "text-red-400"
                              : "text-gray-500"
                          }
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
        <FaHistory size={13} /> Logs Perubahan
      </h2>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}

      <div className="space-y-1">
        {commits.map((c) => (
          <button
            key={c.sha}
            onClick={() => openCommit(c.sha)}
            className="w-full text-left bg-panel border border-border rounded-lg p-3 hover:border-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm truncate min-w-0 flex-1">{c.commit.message}</p>
              <div className="flex items-center gap-2 shrink-0">
                <DeployBadge
                  provider="vercel"
                  info={vercelBySha[c.sha]}
                  onOpenLog={(provider, info) => setDebugDeploy({ provider, info })}
                />
                <DeployBadge
                  provider="netlify"
                  info={netlifyBySha[c.sha]}
                  onOpenLog={(provider, info) => setDebugDeploy({ provider, info })}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 min-w-0">
              <img src={c.author?.avatar_url} className="w-4 h-4 rounded-full shrink-0" />
              <span className="truncate">
                {c.commit.author.name} ·{" "}
                {new Date(c.commit.author.date).toLocaleDateString("id-ID")} ·{" "}
                <span className="font-mono">{c.sha.slice(0, 7)}</span>
              </span>
            </div>
          </button>
        ))}
        {!loading && commits.length === 0 && (
          <p className="text-sm text-gray-500">Belum ada riwayat perubahan.</p>
        )}
      </div>

      {debugDeploy && (
        <DeployLogDebugger
          title={`Log Build ${LABEL[debugDeploy.provider]}`}
          jobName={`${LABEL[debugDeploy.provider]} Build`}
          logsUrl={`/api/${debugDeploy.provider}/deployment-logs?deploymentId=${debugDeploy.info.id}`}
          deploymentUrl={debugDeploy.info.url}
          onClose={() => setDebugDeploy(null)}
        />
      )}
    </div>
  );
}
