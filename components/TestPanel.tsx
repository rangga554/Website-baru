"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FaPlay, FaCheckCircle, FaTimesCircle, FaSpinner, FaClock,
  FaFileCode, FaGlobe, FaBug,
} from "react-icons/fa";
import LogDebugger from "./LogDebugger";
import ProviderPreview from "./ProviderPreview";

type Workflow = { id: number; name: string; path: string; state: string };
type Run = {
  id: number;
  name: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  html_url: string;
  head_branch: string;
  created_at: string;
  run_number: number;
};

const STARTER_WORKFLOW = `name: Test

on:
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build --if-present
      - run: npm test --if-present
`;

function StatusBadge({ run }: { run: Run }) {
  if (run.status !== "completed") {
    return (
      <span className="flex items-center gap-1 text-yellow-400 text-xs">
        <FaSpinner size={10} className="animate-spin" />
        {run.status === "queued" ? "Antri" : "Jalan"}
      </span>
    );
  }
  if (run.conclusion === "success") {
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

export default function TestPanel({
  owner,
  repo,
  branch,
  onClose,
  onStartTest,
}: {
  owner: string;
  repo: string;
  branch: string;
  onClose: () => void;
  onStartTest: (url: string) => void;
}) {
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [selectedWf, setSelectedWf] = useState<number | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [vercelVisible, setVercelVisible] = useState<boolean | null>(null);
  const [netlifyVisible, setNetlifyVisible] = useState<boolean | null>(null);
  const [logDebugRun, setLogDebugRun] = useState<Run | null>(null);

  // Response error body kadang bukan JSON (misal Next.js ngebalikin halaman HTML
  // 500), jadi res.json() sendiri bisa throw. Helper ini selalu ngasih string
  // yang bisa ditampilkan, apapun bentuk error-nya.
  async function readError(res: Response, fallback: string) {
    try {
      const d = await res.json();
      return d?.error || fallback;
    } catch {
      return `${fallback} (HTTP ${res.status})`;
    }
  }

  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/actions/workflows`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
        if (data.length > 0) setSelectedWf(data[0].id);
      } else {
        setWorkflows([]);
        setError(await readError(res, "Gagal ambil daftar workflow"));
      }
    } catch (e: any) {
      setWorkflows([]);
      setError(e?.message || "Gagal ambil daftar workflow. Cek koneksi internet.");
    }
  }, [owner, repo]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/actions/runs?ref=${encodeURIComponent(branch)}`
      );
      if (res.ok) setRuns(await res.json());
    } catch {
      // auto-refresh gagal sesekali ga perlu ganggu user pakai pesan error
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadWorkflows();
      await loadRuns();
      setLoading(false);
    })();
  }, [loadWorkflows, loadRuns]);

  // Auto-refresh tiap 5 detik selama masih ada run yang belum selesai
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status !== "completed");
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(loadRuns, 5000);
    }
    if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runs, loadRuns]);

  async function triggerTest() {
    if (!selectedWf) return;
    setError("");
    setTriggering(true);
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/actions/dispatch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow_id: selectedWf, ref: branch }),
      });
      if (!res.ok) {
        setError(await readError(res, "Gagal trigger test"));
        return;
      }
      // GitHub butuh beberapa detik sebelum run baru muncul di list
      setTimeout(loadRuns, 2500);
    } catch (e: any) {
      setError(e?.message || "Gagal trigger test. Cek koneksi internet.");
    } finally {
      setTriggering(false);
    }
  }

  async function createStarterWorkflow() {
    setCreatingWorkflow(true);
    setError("");
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: ".github/workflows/test.yml",
          content: STARTER_WORKFLOW,
          message: "Add CI test workflow via KRYNOS",
          branch,
        }),
      });
      if (res.ok) {
        await loadWorkflows();
      } else {
        setError(await readError(res, "Gagal membuat workflow CI"));
      }
    } catch (e: any) {
      setError(e?.message || "Gagal membuat workflow CI. Cek koneksi internet.");
    } finally {
      setCreatingWorkflow(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Test Project</h2>
          <button onClick={onClose} className="text-gray-400 text-sm">
            Tutup
          </button>
        </div>

        {/* --- Live Preview (Vercel / Netlify, otomatis nyesuain yang ke-link) --- */}
        <ProviderPreview
          owner={owner}
          repo={repo}
          branch={branch}
          provider="vercel"
          onStartTest={onStartTest}
          onVisibilityChange={setVercelVisible}
        />
        <ProviderPreview
          owner={owner}
          repo={repo}
          branch={branch}
          provider="netlify"
          onStartTest={onStartTest}
          onVisibilityChange={setNetlifyVisible}
        />
        {vercelVisible === false && netlifyVisible === false && (
          <div className="mb-5 pb-5 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <FaGlobe size={12} className="text-accent" /> Live Preview
            </h3>
            <p className="text-xs text-gray-500">
              Belum ada Vercel atau Netlify yang terhubung ke repo ini. Deploy repo ini ke salah
              satu (nama project/site-nya samain dengan nama repo, atau link langsung ke repo
              GitHub ini) buat mengaktifkan live preview.
            </p>
          </div>
        )}

        {/* --- CI Build & Test (GitHub Actions) --- */}
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <FaFileCode size={12} className="text-accent" /> Build &amp; Test (CI)
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">Memuat workflow...</p>
        ) : workflows && workflows.length === 0 ? (
          <div className="text-center py-6">
            <FaFileCode size={28} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-400 mb-4">
              Repo ini belum punya GitHub Actions workflow. Buat workflow CI dasar
              (npm install → build → test) di branch <b>{branch}</b>?
            </p>
            <button
              onClick={createStarterWorkflow}
              disabled={creatingWorkflow}
              className="bg-accent px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {creatingWorkflow ? "Membuat..." : "Buat Workflow CI"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <select
                value={selectedWf ?? ""}
                onChange={(e) => setSelectedWf(Number(e.target.value))}
                className="flex-1 bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none"
              >
                {workflows?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                onClick={triggerTest}
                disabled={triggering}
                className="flex items-center gap-1.5 bg-accent px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
              >
                <FaPlay size={11} />
                {triggering ? "Trigger..." : "Run Test"}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg mb-3">{error}</p>
            )}

            <p className="text-xs text-gray-500 mb-2">Riwayat run di branch {branch}:</p>
            <div className="space-y-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setLogDebugRun(r)}
                  className="w-full flex items-center justify-between bg-base border border-border rounded-lg p-3 hover:border-accent text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      {r.name} <span className="text-gray-500">#{r.run_number}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <FaClock size={9} />
                      {new Date(r.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <StatusBadge run={r} />
                    <span className="flex items-center gap-1 text-accent text-[11px]">
                      <FaBug size={10} /> Logs
                    </span>
                  </div>
                </button>
              ))}
              {runs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Belum ada run. Klik "Run Test" buat mulai.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {logDebugRun && (
        <LogDebugger
          owner={owner}
          repo={repo}
          runId={logDebugRun.id}
          runLabel={`${logDebugRun.name} #${logDebugRun.run_number}`}
          onClose={() => setLogDebugRun(null)}
        />
      )}
    </div>
  );
}
