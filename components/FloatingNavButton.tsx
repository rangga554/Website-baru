"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FaHome, FaSyncAlt } from "react-icons/fa";

const STORAGE_KEY = "mastercode_floatnav_pos";
const HIDDEN_ON = ["/login", "/register"];
const DRAG_THRESHOLD = 6; // px — di bawah ini dianggap klik, bukan drag

export default function FloatingNavButton() {
  const pathname = usePathname();
  const router = useRouter();

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean; moved: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Posisi awal: pojok kanan-bawah, atau posisi terakhir dari localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPos(JSON.parse(saved));
        return;
      }
    } catch {}
    setPos({ x: window.innerWidth - 64, y: window.innerHeight - 120 });
  }, []);

  function clampToViewport(x: number, y: number) {
    const size = 48;
    const maxX = window.innerWidth - size - 8;
    const maxY = window.innerHeight - size - 8;
    return { x: Math.min(Math.max(8, x), Math.max(8, maxX)), y: Math.min(Math.max(8, y), Math.max(8, maxY)) };
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (!pos) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, dragging: true, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const ds = dragState.current;
    if (!ds || !ds.dragging) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) ds.moved = true;
    const next = clampToViewport(ds.origX + dx, ds.origY + dy);
    setPos(next);
  }

  function onPointerUp(e: ReactPointerEvent) {
    const ds = dragState.current;
    if (!ds) return;
    dragState.current = null;
    if (pos) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    }
    if (!ds.moved) {
      // Klik beneran (gak digeser) -> toggle menu.
      setMenuOpen((v) => !v);
    }
  }

  if (HIDDEN_ON.includes(pathname || "")) return null;
  if (!pos) return null;

  return (
    <>
      {menuOpen && (
        // Backdrop transparan buat nutup menu kalau klik di luar.
        <div className="fixed inset-0 z-[998]" onClick={() => setMenuOpen(false)} />
      )}

      <div className="fixed z-[999]" style={{ left: pos.x, top: pos.y }}>
        {menuOpen && (
          <div
            className="absolute bottom-14 right-0 w-48 rounded-xl border border-white/10 bg-[#181818] shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/dashboard");
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 text-left"
            >
              <FaHome size={13} /> Kembali ke Dashboard
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                window.location.reload();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 text-left border-t border-white/10"
            >
              <FaSyncAlt size={12} /> Reload
            </button>
          </div>
        )}

        <button
          ref={btnRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="w-12 h-12 rounded-full bg-white text-black shadow-lg flex items-center justify-center font-bold text-sm select-none touch-none active:scale-95 transition-transform"
          style={{ cursor: "grab" }}
          aria-label="Menu navigasi cepat"
        >
          {"><"}
        </button>
      </div>
    </>
  );
}
