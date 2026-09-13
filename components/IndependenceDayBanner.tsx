"use client";

import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { eventBannerMessage } from "@/lib/eventShared";
import { useEventStatus } from "./EventStatusProvider";

export default function IndependenceDayBanner() {
  const event = useEventStatus();
  const [dismissed, setDismissed] = useState(false);

  const dismissKey = `mc-hutri-banner-dismissed-${event.hutNumber}-${new Date().toDateString()}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  if (!event.active || dismissed) return null;

  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  }

  // Deret pita segitiga (bunting) merah-putih selang-seling di atas banner
  const flags = Array.from({ length: 24 });

  return (
    <div className="relative z-40 select-none">
      <div className="flex overflow-hidden h-3" aria-hidden="true">
        {flags.map((_, i) => (
          <span
            key={i}
            className="hutri-flag"
            style={{ borderTopColor: i % 2 === 0 ? "#dc2626" : "#f8fafc" }}
          />
        ))}
      </div>

      <div className="relative bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none hutri-stars" aria-hidden="true" />
        <div className="relative max-w-5xl mx-auto flex items-center gap-3 px-4 py-2.5 text-xs sm:text-sm">
          <span className="text-lg leading-none shrink-0" aria-hidden="true">
            🇮🇩
          </span>
          <p className="flex-1 min-w-0 font-medium leading-snug">
            {eventBannerMessage(event.hutNumber)} <span aria-hidden="true">🎉</span>
          </p>
          <button
            onClick={dismiss}
            aria-label="Tutup banner"
            className="shrink-0 p-1.5 rounded-md hover:bg-white/15 transition-colors"
          >
            <FaTimes size={12} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .hutri-flag {
          flex: 1 0 auto;
          width: 0;
          height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 12px solid;
          margin: 0 2px;
          opacity: 0.9;
        }
        .hutri-stars {
          background-image: radial-gradient(circle, #fff 1px, transparent 1.5px);
          background-size: 22px 22px;
        }
      `}</style>
    </div>
  );
}
