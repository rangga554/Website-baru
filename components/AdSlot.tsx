"use client";

import { useEffect, useRef, useState } from "react";

// Slot iklan Adsterra. Ada 4 varian, masing-masing punya "key" unik dari
// dashboard Adsterra punya user (mastercode.my.id):
//   - native      : Native Banner (layout 4:1, ngikutin lebar container)
//   - 300x250     : Banner rectangle
//   - 320x50      : Banner mobile (pas buat layar HP)
//   - 728x90      : Banner leaderboard (buat layar lebar/desktop)
//
// KENAPA IFRAME-NYA NUNJUK KE ROUTE /ad-frame/[variant] (bukan srcDoc
// langsung di sini): 2 alasan sekaligus.
// 1) Script Adsterra (invoke.js) internalnya masih pakai document.write().
//    Kalau ditempel LANGSUNG ke halaman React, document.write() yang
//    dipanggil SETELAH halaman selesai load bakal nge-WIPE SELURUH ISI
//    HALAMAN (perilaku standar browser). Ditaro di dokumen iframe
//    terpisah, efeknya kesekat di situ doang.
// 2) KRYNOS punya Content-Security-Policy ketat yang cuma ngizinin
//    script dari domain sendiri. Iframe pake "srcDoc" DIANGGAP SATU
//    ORIGIN sama halaman induk, jadi IKUT NURUTIN CSP itu — akibatnya
//    script Adsterra ke-block browser (iklannya kosong melompong).
//    Dengan iframe "src" nunjuk ke URL/route sendiri (/ad-frame/xxx),
//    halaman itu punya CSP-nya SENDIRI yang di-override lebih longgar
//    KHUSUS buat path itu doang (lihat next.config.js) — CSP inti punya
//    seluruh app gak perlu dilonggarin sama sekali.
//
// LAZY LOAD: iframe baru di-render (baru mulai ngambil skrip Adsterra)
// pas slotnya beneran KELIATAN di layar (atau 200px lagi bakal keliatan),
// bukan pas halaman pertama kali dibuka. Ini biar ngebuka Dashboard tetap
// cepet walau ada beberapa slot iklan sekaligus di halaman.

export type AdVariant = "native" | "300x250" | "320x50" | "728x90";

const DIMENSIONS: Record<AdVariant, { width: number | "100%"; height: number }> = {
  native: { width: "100%", height: 110 },
  "300x250": { width: 300, height: 250 },
  "320x50": { width: 320, height: 50 },
  "728x90": { width: 728, height: 90 },
};

export default function AdSlot({
  variant,
  className = "",
}: {
  variant: AdVariant;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dims = DIMENSIONS[variant];

  return (
    <div
      ref={wrapperRef}
      className={`overflow-hidden ${className}`}
      style={{ width: "100%", maxWidth: dims.width === "100%" ? "100%" : dims.width, height: dims.height }}
    >
      {visible && (
        <iframe
          title={`ad-${variant}`}
          src={`/ad-frame/${variant}`}
          scrolling="no"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />
      )}
    </div>
  );
}
