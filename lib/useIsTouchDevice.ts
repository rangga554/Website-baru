"use client";

import { useEffect, useState } from "react";

// Deteksi device dengan input utama touch (HP/tablet) vs mouse+keyboard
// (PC/laptop). Pakai media query "(pointer: coarse)" — ini lebih akurat
// dibanding ngecek lebar layar doang, soalnya window kecil di desktop
// (misal browser di-resize sempit) tetap kedeteksi sebagai "bukan touch".
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    setIsTouch(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isTouch;
}
