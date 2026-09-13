"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nampilin angka yang, kalau nilainya berubah dari update sebelumnya,
 * berkedip halus (hijau = nambah, merah = berkurang) selama sesaat lalu
 * balik normal. Tidak pernah bikin apapun di sekitarnya reload/kedip —
 * cuma warna teks angka ini doang yang animasi.
 */
export default function LiveNumber({ value }: { value: number }) {
  const prevValue = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value !== prevValue.current) {
      setFlash(value > prevValue.current ? "up" : "down");
      prevValue.current = value;
      const t = setTimeout(() => setFlash(null), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={`transition-colors duration-700 ${
        flash === "up" ? "text-green-400" : flash === "down" ? "text-red-400" : ""
      }`}
    >
      {value}
    </span>
  );
}
