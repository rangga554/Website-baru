"use client";

import { useEffect, useState } from "react";
import { FaPlus, FaComment } from "react-icons/fa";

export default function IssuesPanel({ owner, repo }: { owner: string; repo: string }) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/issues?state=all`);
    if (res.ok) setIssues(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [owner, repo]);

  async function openIssue(num: number) {
    setOpenId(num);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/issues/${num}/comments`);
    if (res.ok) setComments(await res.json());
  }

  async function sendComment() {
    if (!newComment.trim() || !openId) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/issues/${openId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: newComment }),
    });
    if (res.ok) {
      setNewComment("");
      openIssue(openId);
    }
  }

  async function createIssue() {
    if (!title.trim()) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (res.ok) {
      setTitle("");
      setBody("");
      setShowNewIssue(false);
      load();
    }
  }

  if (openId) {
    const issue = issues.find((i) => i.number === openId);
    return (
      <div className="p-4">
        <button onClick={() => setOpenId(null)} className="text-xs text-accent mb-3">
          ← Kembali ke daftar issue
        </button>
        <h3 className="font-semibold">
          #{issue?.number} {issue?.title}
        </h3>
        <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{issue?.body}</p>

        <div className="mt-5 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-panel border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <img src={c.user.avatar_url} className="w-5 h-5 rounded-full" />
                {c.user.login}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Tulis komentar..."
            className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={sendComment}
            className="bg-accent px-4 rounded-lg text-sm font-medium"
          >
            Kirim
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">Issues</h2>
        <button
          onClick={() => setShowNewIssue(true)}
          className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs font-medium"
        >
          <FaPlus size={10} /> Baru
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Memuat...</p>}

      <div className="space-y-2">
        {issues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => openIssue(issue.number)}
            className="w-full text-left bg-panel border border-border rounded-lg p-3 hover:border-accent"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{issue.title}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                  issue.state === "open"
                    ? "bg-green-900 text-green-300"
                    : "bg-purple-900 text-purple-300"
                }`}
              >
                {issue.state}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <FaComment size={10} /> {issue.comments} komentar · #{issue.number}
            </div>
          </button>
        ))}
        {!loading && issues.length === 0 && (
          <p className="text-sm text-gray-500">Belum ada issue.</p>
        )}
      </div>

      {showNewIssue && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-semibold mb-3 text-sm">Issue Baru</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul"
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none mb-2 focus:border-accent"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Deskripsi..."
              rows={4}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowNewIssue(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                onClick={createIssue}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium"
              >
                Buat Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
