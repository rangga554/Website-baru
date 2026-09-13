"use client";

import { useEffect, useState } from "react";
import {
  FaCheckCircle, FaTimesCircle, FaSpinner, FaRobot,
} from "react-icons/fa";
import CopyContentButton from "./CopyContentButton";

type Job = {
  id: number;
  name: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null;
};

function JobBadge({ job }: { job: Job }) {
  if (job.status !== "completed") {
    return (
      <span className="flex items-center gap-1 text-yellow-400 text-xs">
        <FaSpinner size={10} className="animate-spin" /> Jalan
      </span>
    );
  }
  if (job.conclusion === "success") {
    return (
      <span className="flex items-center gap-1 text-green-400 text-xs">
        <FaCheckCircle size={10} /> Sukses
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-red-400 text-xs">
      <FaTimesCircle size={10} /> Gagal
    </span>
  );
}

export default function LogDebugger({
  owner,
  repo,
  runId,
  runLabel,
  onClose,
}: {
  owner: string;
  repo: string;
  runId: number;
  runLabel: string;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/actions/runs?run_id=${runId}`
      );
      if (res.ok) {
        const data: Job[] = await res.json();
        setJobs(data);
        // Auto-pilih job yang gagal (kalau ada) biar langsung kelihatan.
        const failed = data.find((j) => j.conclusion === "failure");
        openJob(failed || data[0] || null);
      } else {
        setJobs([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, runId]);

  async function openJob(job: Job | null) {
    if (!job) return;
    setSelectedJob(job);
    setLogs("");
    setAnalysis("");
    setAnalyzeError("");
    setLogError("");
    setLoadingLogs(true);
    try {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/actions/runs?job_id=${job.id}`
      );
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs || "(log kosong)");
      } else {
        const d = await res.json().catch(() => ({}));
        setLogError(d.error || "Gagal memuat log");
      }
    } catch (e: any) {
      setLogError(e?.message || "Gagal memuat log. Cek koneksi internet.");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function analyzeWithAI() {
    if (!selectedJob || !logs) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setAnalysis("");
    try {
      const res = await fetch("/api/ai/debug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobName: selectedJob.name, logs }),
      });
      if (res.ok) {
        const d = await res.json();
        setAnalysis(d.analysis);
      } else {
        const d = await res.json().catch(() => ({}));
        setAnalyzeError(d.error || "Gagal menganalisis log");
      }
    } catch (e: any) {
      setAnalyzeError(e?.message || "Gagal menganalisis log. Cek koneksi internet.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FaRobot className="text-accent" size={16} /> Logs &amp; Debugger AI
            </h2>
            <p className="text-xs text-gray-500 truncate">{runLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-sm shrink-0 ml-2">
            Tutup
          </button>
        </div>

        {/* Pemilih job */}
        {jobs === null ? (
          <p className="text-sm text-gray-500">Memuat job...</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-gray-500">Job tidak ditemukan.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 shrink-0">
            {jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => openJob(j)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                  selectedJob?.id === j.id
                    ? "border-accent bg-accent/10"
                    : "border-border bg-base"
                }`}
              >
                <span className="truncate max-w-[140px]">{j.name}</span>
                <JobBadge job={j} />
              </button>
            ))}
          </div>
        )}

        {/* Log mentah */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-base border border-border rounded-lg p-3 mb-3 relative">
          {!loadingLogs && !logError && logs && (
            <CopyContentButton
              getText={() => logs}
              className="absolute top-2 right-2 bg-panel/90 border border-border"
              iconOnly
            />
          )}
          {loadingLogs ? (
            <p className="text-xs text-gray-500">Memuat log...</p>
          ) : logError ? (
            <p className="text-xs text-red-400">{logError}</p>
          ) : (
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-gray-300 font-mono pr-8">
              {logs}
            </pre>
          )}
        </div>

        {/* Tombol & hasil AI Debugger */}
        <div className="shrink-0">
          <button
            onClick={analyzeWithAI}
            disabled={analyzing || !logs || loadingLogs}
            className="w-full flex items-center justify-center gap-2 bg-accent py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 mb-3"
          >
            <FaRobot size={13} />
            {analyzing ? "Menganalisis log..." : "Analisis dengan AI"}
          </button>

          {analyzeError && (
            <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg mb-2">
              {analyzeError}
            </p>
          )}

          {analysis && (
            <div className="max-h-52 overflow-y-auto bg-accent/5 border border-accent/30 rounded-lg p-3 relative">
              <CopyContentButton
                getText={() => analysis}
                className="absolute top-1.5 right-1.5 bg-panel/90 border border-border"
                iconOnly
              />
              <p className="text-xs whitespace-pre-wrap leading-relaxed pr-7">{analysis}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
