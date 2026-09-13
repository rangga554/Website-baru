"use client";

import { FaDownload } from "react-icons/fa";
import { downloadFromUrl } from "@/lib/nativeDownload";

export default function ImageViewer({
  path,
  base64,
}: {
  path: string;
  base64: string;
}) {
  const ext = path.split(".").pop()?.toLowerCase() || "png";
  const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
  const dataUrl = `data:${mime};base64,${base64.replace(/\n/g, "")}`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto bg-[#0a0d12]">
      <img
        src={dataUrl}
        alt={path}
        className="max-w-full max-h-[70dvh] rounded-lg shadow-lg object-contain"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      />
      <button
        onClick={() => downloadFromUrl(dataUrl, path.split("/").pop() || "image")}
        className="mt-4 flex items-center gap-2 bg-panel border border-border px-4 py-2 rounded-lg text-sm active:scale-95"
      >
        <FaDownload size={12} /> Download
      </button>
    </div>
  );
}
