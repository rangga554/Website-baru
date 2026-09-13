"use client";

import { FaExternalLinkAlt, FaFilm } from "react-icons/fa";

// Nangkep FILE_ID dari berbagai bentuk URL Google Drive yang umum dipakai:
//   https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
//   https://drive.google.com/file/d/FILE_ID/preview
//   https://drive.google.com/open?id=FILE_ID
//   https://drive.google.com/uc?id=FILE_ID&export=download
function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

export default function VideoLinkPlayer({
  path,
  url,
}: {
  path: string;
  url: string;
}) {
  const fileName = path.split("/").pop() || path;
  const trimmed = url.trim();
  const driveId = trimmed ? extractDriveFileId(trimmed) : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto bg-[#0a0d12]">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-panel p-6 flex flex-col items-center gap-4">
        {!trimmed ? (
          <>
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
              <FaFilm className="text-accent" size={24} />
            </div>
            <p className="text-sm text-gray-400 text-center">
              File ini belum ada link video-nya. Masuk mode Edit, tempel link Google
              Drive (atau URL video langsung) di sini, lalu simpan.
            </p>
          </>
        ) : driveId ? (
          // Embed resmi Google Drive — otomatis stream langsung dari Drive,
          // gak numpuk ukuran repo/commit sama sekali (isi file di GitHub
          // cuma teks link ini, bukan video-nya).
          <iframe
            src={`https://drive.google.com/file/d/${driveId}/preview`}
            allow="autoplay"
            className="w-full aspect-video rounded-lg border-0"
            title={fileName}
          />
        ) : (
          // Bukan link Drive -> anggap URL video langsung (mp4 publik dll),
          // coba mainkan pakai <video> tag browser biasa.
          <video controls preload="metadata" src={trimmed} className="w-full rounded-lg max-h-[60vh]" />
        )}

        <p className="text-sm text-gray-200 text-center break-all">{fileName}</p>

        {trimmed && (
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-base border border-border px-4 py-2 rounded-lg text-sm active:scale-95"
          >
            <FaExternalLinkAlt size={11} /> Buka Link Aslinya
          </a>
        )}
      </div>
    </div>
  );
}
