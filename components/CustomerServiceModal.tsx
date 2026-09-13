"use client";

import { useEffect, useRef, useState } from "react";
import { FaHeadset, FaTimes, FaPaperPlane } from "react-icons/fa";

type ChatMsg = { role: "user" | "assistant"; content: string };

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Halo! 👋 Aku Customer Service AI KRYNOS. Aku bisa bantu jelasin fitur-fitur KRYNOS secara detail (upload, Plus, extract, komunitas, dll) atau bantu kalau kamu ada keluhan soal app ini. Mau tanya apa?",
};

export default function CustomerServiceModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    const newMessages: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/cs/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi Customer Service AI");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-8">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl my-auto flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="font-bold flex items-center gap-2 text-accent">
            <FaHeadset /> Customer Service AI
          </h2>
          <button onClick={onClose} className="text-gray-400 p-1">
            <FaTimes />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[240px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-accent text-white rounded-br-sm"
                    : "bg-black/30 border border-border text-gray-200 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-black/30 border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-gray-500">
                Mengetik...
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-400 px-3 pb-1 shrink-0">{error}</p>}

        <div className="flex items-center gap-2 p-3 border-t border-border shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Tanya soal KRYNOS..."
            className="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="bg-accent rounded-lg p-2.5 disabled:opacity-50 shrink-0"
          >
            <FaPaperPlane size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
