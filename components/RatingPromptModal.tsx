"use client";

import { FaStar, FaTimes, FaExternalLinkAlt } from "react-icons/fa";

export const APKPURE_REVIEW_URL = "https://apkpure.com/id/reviews/com.mastercode";

export default function RatingPromptModal({
  onRate,
  onLater,
  onNeverAskAgain,
}: {
  onRate: () => void;
  onLater: () => void;
  onNeverAskAgain: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="flex justify-end px-3 pt-3">
          <button onClick={onLater} className="text-gray-500 p-1" aria-label="Tutup">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col items-center text-center gap-3">
          <div className="flex gap-1 text-amber-400 text-2xl">
            <FaStar /> <FaStar /> <FaStar /> <FaStar /> <FaStar />
          </div>
          <h2 className="font-bold text-lg">Suka pakai KRYNOS?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Bantu KRYNOS berkembang dengan kasih rating & ulasan singkat di APKPure.
            Gak sampai 1 menit, tapi sangat berarti buat kami 🙏
          </p>

          <button
            onClick={onRate}
            className="w-full flex items-center justify-center gap-2 bg-accent rounded-lg py-2.5 text-sm font-medium"
          >
            <FaStar size={13} /> Beri Rating di APKPure <FaExternalLinkAlt size={10} />
          </button>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <button onClick={onLater} className="hover:text-gray-300">
              Nanti aja
            </button>
            <button onClick={onNeverAskAgain} className="hover:text-gray-300">
              Jangan tampilkan lagi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
