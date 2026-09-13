"use client";

import { useState } from "react";
import { FaStar } from "react-icons/fa";

const LABELS: Record<number, string> = {
  1: "Sangat gak puas",
  2: "Gak puas",
  3: "Biasa aja",
  4: "Puas",
  5: "Sangat puas",
};

// Input rating bintang 1-5, tap buat pilih. Dipisah jadi komponen sendiri
// biar bisa dipakai ulang (survey, atau nanti kalau ada tempat lain yang
// butuh rating serupa).
export default function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1 active:scale-90 transition-transform"
            aria-label={`${n} bintang`}
          >
            <FaStar
              size={30}
              className={n <= shown ? "text-amber-400" : "text-gray-700"}
            />
          </button>
        ))}
      </div>
      {shown > 0 && (
        <p className="text-xs text-amber-400 mt-1.5 font-medium">{LABELS[shown]}</p>
      )}
    </div>
  );
}
