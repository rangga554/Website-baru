"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaCheckCircle, FaTimesCircle, FaSpinner, FaStop, FaExternalLinkAlt, FaBug, FaSync,
} from "react-icons/fa";
import DeployLogDebugger from "./DeployLogDebugger";

type Provider = "vercel" | "netlify";

const LABEL: Record<Provider, string> = { vercel: "Vercel", netlify: "Netlify" };

export default function ProviderPreview({
  owner,
  repo,
  branch,
  provider,
  onStartTest,
  onVisibilityChange,
}: {
  owner: string;
  repo: string;
  branch: string;
  provider: Provider;
  onStartTest: (url: string) => void;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const apiBase = `/api/${provider}`;
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function readError(res: Response, fallback: string) {
    try {
      const d = await res.json();
      return d?.error || fallback;
    } catch {
      return `${fallback} (HTTP ${res.status})`;
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBase}/deployment?owner=${owner}&repo=${repo}&branch=${encodeURIComponent(branch)}`
      );
      if (res.ok) setPreview(await res.json());
      else setPreview({ error: await readError(res, "Gagal ambil status deployment") });
    } catch (e: any) {
      setPreview({ error: e?.message || "Gagal ambil status deployment. Cek koneksi internet." });
    } finally {
      setLoading(false);
    }
  }, [apiBase, owner, repo, branch]);

  useEffect(() => {
    load();
  }, [load]);

  // Cuma tampil kalau provider ini beneran ke-link ke repo ini (connected)
  // ATAU lagi error koneksi (biar user tau ada masalah, bukan cuma hilang
  // diam-diam). Kalau belum di-setup / repo emang ga pakai provider ini,
  // card-nya disembunyikan total — biar ga numpuk 2 provider yang gak
  // relevan buat repo yang cuma pakai 1.
  const visible = !loading && (preview?.connected === true || !!preview?.error);
  useEffect(() => {
    onVisibilityChange(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const building =
      preview?.deployment && !["READY", "ERROR", "CANCELED"].includes(preview.deployment.state);
    if (building && !pollRef.current) pollRef.current = setInterval(load, 6000);
    if (!building && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [preview, load]);

  async function stopPreview() {
    if (!preview?.deployment?.id) return;
    setCancelling(true);
    try {
      const res = await fetch(`${apiBase}/deployment/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deploymentId: preview.deployment.id }),
      });
      if (res.ok) await load();
    } finally {
      setCancelling(false);
    }
  }

  if (loading || !visible) return null;

  return (
    <div className="mb-5 pb-5 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${provider === "vercel" ? "bg-white" : "bg-teal-400"}`}
          />
          Live Preview ({LABEL[provider]})
        </h3>
        <button onClick={load} className="text-gray-400 p-1">
          <FaSync size={11} />
        </button>
      </div>

      {preview?.error ? (
        <div className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg flex items-center justify-between gap-2">
          <span>{preview.error}</span>
          <button onClick={load} className="underline shrink-0">
            Coba lagi
          </button>
        </div>
      ) : !preview?.deployment ? (
        <p className="text-xs text-gray-500">
          Belum ada deployment {LABEL[provider]} untuk branch <b>{branch}</b>. Push/commit dulu
          biar {LABEL[provider]} mulai build.
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-base border border-border rounded-lg p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              {preview.deployment.state === "READY" && (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <FaCheckCircle size={10} /> Live
                </span>
              )}
              {preview.deployment.state === "ERROR" && (
                <span className="flex items-center gap-1 text-red-400 text-xs">
                  <FaTimesCircle size={10} /> Gagal build
                </span>
              )}
              {!["READY", "ERROR", "CANCELED"].includes(preview.deployment.state) && (
                <span className="flex items-center gap-1 text-yellow-400 text-xs">
                  <FaSpinner size={10} className="animate-spin" /> Building...
                </span>
              )}
              {preview.deployment.state === "CANCELED" && (
                <span className="flex items-center gap-1 text-gray-400 text-xs">
                  <FaStop size={10} /> Dibatalkan
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate">{preview.deployment.url}</p>
          </div>

          {preview.deployment.state === "READY" && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
              <button
                onClick={() => onStartTest(preview.deployment.url)}
                className="bg-panel border border-border px-3 py-1.5 rounded-lg text-xs"
              >
                Test
              </button>
              <a
                href={preview.deployment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                Buka <FaExternalLinkAlt size={9} />
              </a>
            </div>
          )}
          {preview.deployment.state === "ERROR" && (
            <button
              onClick={() => setDebugOpen(true)}
              className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
            >
              <FaBug size={10} />
              Lihat Log &amp; AI
            </button>
          )}
          {!["READY", "ERROR", "CANCELED"].includes(preview.deployment.state) && (
            <button
              onClick={stopPreview}
              disabled={cancelling}
              className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 disabled:opacity-50"
            >
              <FaStop size={10} />
              {cancelling ? "Menghentikan..." : "Stop"}
            </button>
          )}
        </div>
      )}

      {debugOpen && preview?.deployment && (
        <DeployLogDebugger
          title={`Log Build ${LABEL[provider]}`}
          jobName={`${LABEL[provider]} Build`}
          logsUrl={`${apiBase}/deployment-logs?deploymentId=${preview.deployment.id}`}
          deploymentUrl={preview.deployment.url}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}
