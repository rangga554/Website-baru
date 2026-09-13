"use client";

import { useState } from "react";
import { FaDownload, FaMusic } from "react-icons/fa";
import { downloadFromUrl } from "@/lib/nativeDownload";

export default function AudioPlayer({
  path,
  src,
}: {
  path: string;
  src: string;
}) {
  const fileName = path.split("/").pop() || path;
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto bg-[#0a0d12]">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
          <FaMusic className="text-accent" size={24} />
        </div>
        <p className="text-sm text-gray-200 text-center break-all">{fileName}</p>

        {/* Player asli browser — src langsung ke endpoint /raw (binary asli,
            BUKAN base64 dibungkus JSON). Browser yang narik & stream sendiri
            filenya, jadi gak kena batas ukuran response API route. */}
        <audio
          controls
          preload="metadata"
          src={src}
          className="w-full"
          onError={() => setLoadError(true)}
        />

        {loadError && (
          <p className="text-xs text-red-400 text-center">
            Gagal muat file musik ini. Coba refresh, atau cek koneksi internet kamu.
          </p>
        )}

        <button
          onClick={() => downloadFromUrl(src, fileName)}
          className="flex items-center gap-2 bg-base border border-border px-4 py-2 rounded-lg text-sm active:scale-95"
        >
          <FaDownload size={12} /> Download
        </button>
      </div>
    </div>
  );
}
