"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaPaperPlane, FaTimesCircle } from "react-icons/fa";
import { useLivePolling } from "@/lib/useLivePolling";
import { useRole } from "@/lib/useRole";
import RoleBadge from "@/components/RoleBadge";

type DmMessage = {
  id: string;
  conversation_id: string;
  sender_login: string;
  content: string;
  created_at: string;
};

type DmConversation = {
  id: string;
  user_login: string;
  admin_login: string;
};

export default function MessageThreadPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const login = (session as any)?.login as string | undefined;
  const { isPrivileged, loading: roleLoading } = useRole(login);

  const [conversation, setConversation] = useState<DmConversation | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/conversations/${params.id}/messages`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh]);

  useLivePolling(refresh, 2000, status === "authenticated" && !notFound);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    try {
      const res = await fetch(`/api/messages/conversations/${params.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) refresh();
    } finally {
      setSending(false);
    }
  }

  async function endChat() {
    if (
      !confirm(
        "Akhiri obrolan ini? Semua pesan di obrolan ini akan DIHAPUS PERMANEN dari server, gak bisa dibalikin lagi."
      )
    )
      return;
    setEnding(true);
    const res = await fetch(`/api/messages/conversations/${params.id}`, { method: "DELETE" });
    setEnding(false);
    if (res.ok) router.push("/messages");
  }

  const otherLogin =
    conversation && login
      ? conversation.user_login.toLowerCase() === login.toLowerCase()
        ? conversation.admin_login
        : conversation.user_login
      : null;

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-panel sticky top-0 z-10">
        <Link href="/messages" className="p-1.5 -ml-1 text-gray-400 hover:text-white">
          <FaArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate flex items-center gap-1.5">
            {otherLogin || "..."}
            {otherLogin && <RoleBadge login={otherLogin} />}
          </p>
        </div>
        {isPrivileged && conversation && (
          <button
            onClick={endChat}
            disabled={ending}
            className="flex items-center gap-1.5 text-[11px] text-red-400 border border-red-400/30 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
          >
            <FaTimesCircle size={11} />
            {ending ? "Mengakhiri..." : "Akhiri Obrolan"}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {loading || roleLoading ? (
          <p className="text-sm text-gray-500 text-center py-10">Memuat...</p>
        ) : notFound ? (
          <p className="text-sm text-gray-500 text-center py-10">
            Obrolan ini gak ketemu — mungkin udah diakhiri oleh Owner/Admin.
          </p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender_login.toLowerCase() === login?.toLowerCase();
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      mine ? "bg-accent text-white rounded-br-sm" : "bg-panel border border-border rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!notFound && !loading && (
        <div className="border-t border-border bg-panel px-4 py-3 sticky bottom-0">
          <div className="max-w-lg mx-auto flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Tulis pesan..."
              className="flex-1 bg-black/30 border border-border rounded-full px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="w-10 h-10 shrink-0 rounded-full bg-accent flex items-center justify-center disabled:opacity-50"
            >
              <FaPaperPlane size={13} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
