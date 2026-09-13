"use client";

import { useRef, useState } from "react";
import { FaUpload, FaFileUpload, FaFolderPlus, FaImage, FaFileArchive, FaFolderOpen, FaLock, FaTrashAlt } from "react-icons/fa";
import {
  detectConnectionQuality, chunkParamsFor, splitIntoChunks, QUALITY_LABEL,
} from "@/lib/uploadChunking";
import { usePlusStatus } from "@/lib/usePlusStatus";
import PlusUpgradeModal from "@/components/PlusUpgradeModal";

// Folder/file yang di-skip default (bisa dimatikan lewat toggle "upload semua file")
const IGNORED_SEGMENTS = ["node_modules", ".next", ".git", ".vercel", ".DS_Store"];
// File ini SELALU dicek terpisah karena isinya kredensial (bukan cuma "gak perlu", tapi beresiko bocor)
const SECRET_PATTERNS = [".env", ".env.local", ".env.production", ".env.development"];

function shouldIgnore(relPath: string) {
  const segments = relPath.split("/");
  return segments.some((s) => IGNORED_SEGMENTS.includes(s));
}

function isSecretFile(relPath: string) {
  const filename = relPath.split("/").pop() || "";
  return SECRET_PATTERNS.some((p) => filename === p || filename.startsWith(p + "."));
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Konversi Uint8Array -> base64 tanpa bikin call stack overflow buat file
// gede (String.fromCharCode.apply langsung ke array besar bisa crash).
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
}

// Buang segmen path paling depan (nama folder utama), sisain childnya aja.
// "project-utama/src/index.js" -> "src/index.js"
function stripTopLevelFolder(relPath: string): string {
  const idx = relPath.indexOf("/");
  return idx >= 0 ? relPath.slice(idx + 1) : relPath;
}

// Baca isi file .zip jadi daftar PendingFile (dipake bareng handleZipFile
// biasa dan handleDeleteAndExtractZip) — logic strip folder pembungkus
// tunggal sama persis kayak upload ZIP biasa.
async function readZipEntries(file: File): Promise<PendingFile[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);
  const fileEntries = Object.values(zip.files).filter((e) => !e.dir);

  if (fileEntries.length === 0) {
    throw new Error("ZIP kosong atau formatnya gak valid.");
  }

  const topSegments = new Set(fileEntries.map((e) => e.name.split("/")[0]));
  let prefixToStrip = "";
  if (topSegments.size === 1) {
    const only = Array.from(topSegments)[0];
    if (fileEntries.every((e) => e.name.startsWith(only + "/"))) {
      prefixToStrip = only + "/";
    }
  }

  return Promise.all(
    fileEntries.map(async (e) => {
      const bytes = await e.async("uint8array");
      return {
        relPath: prefixToStrip ? e.name.slice(prefixToStrip.length) : e.name,
        size: bytes.byteLength,
        getBase64: async () => uint8ToBase64(bytes),
      };
    })
  );
}

type UploadFilePayload = { path: string; content: string; isBase64: boolean };

// Kode HTTP yang biasanya nandain masalah SINYAL/server sesaat (bukan
// kesalahan beneran di data yang dikirim) — layak di-retry terus.
// Selain ini (400/401/403/404/409/413/422/dll) dianggap error ASLI, retry
// gak akan nolong, jadi langsung berhenti.
function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

// Nunggu sampai browser lapor online lagi (event 'online'), TAPI juga
// di-poll tiap 3 detik jaga-jaga kalau event-nya gak kepicu (beberapa
// browser Android suka gitu pas transisi WiFi<->data). Selesai lebih cepat
// kalau salah satu duluan.
function waitUntilOnline(isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("online", onOnline);
      clearInterval(poll);
      resolve();
    };
    const onOnline = () => finish();
    window.addEventListener("online", onOnline);
    const poll = setInterval(() => {
      if (isCancelled() || navigator.onLine !== false) finish();
    }, 3000);
  });
}

type UploadChunkResult =
  | { ok: true; skippedCount: number; uploadedCount: number }
  | { ok: false; error: string; cancelled?: boolean };

// Upload 1 batch. Beda sama versi lama: gak ada batas maksimal percobaan
// buat masalah SINYAL — selama koneksi masih goyang/putus-nyambung, fungsi
// ini bakal terus DIPERLAMBAT (backoff makin lama, di-cap 30 detik) dan
// DIJEDA (nunggu browser online lagi) alih-alih nyerah abis 3-4x coba.
// Cuma 2 hal yang bikin fungsi ini beneran berhenti:
//   1. Error ASLI dari server (400/401/403/404/409/dll) — bukan soal sinyal,
//      diulang-ulang juga hasilnya bakal sama.
//   2. User pencet "Batalkan" (isCancelled() jadi true).
async function uploadChunkWithRetry(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: UploadFilePayload[],
  onRetry: (status: "backoff" | "offline" | "splitting", attempt: number, waitMs: number) => void,
  isCancelled: () => boolean = () => false
): Promise<UploadChunkResult> {
  let lastError = "Gagal upload";
  let attempt = 0;

  while (true) {
    if (isCancelled()) return { ok: false, error: "Dibatalkan pengguna.", cancelled: true };

    // Kalau browser udah lapor offline duluan, gak usah coba fetch (bakal
    // pasti gagal) — langsung jeda nunggu sinyal balik.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onRetry("offline", attempt, 0);
      await waitUntilOnline(isCancelled);
      if (isCancelled()) return { ok: false, error: "Dibatalkan pengguna.", cancelled: true };
    }

    attempt++;
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/tree`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branch, message, files }),
      });

      // HTTP 413 (Payload Too Large) BUKAN soal sinyal, dan nunggu/backoff
      // gak bakal nolong sama sekali — request-nya emang kegedean buat
      // batas keras body Vercel (~4.5MB). Satu-satunya cara "sembuh" itu
      // dikecilin. Kalau batch-nya masih bisa dibelah (>1 file), belah dua
      // & upload tiap belahan SATU-SATU (rekursif) — jadi bukan berhenti,
      // tapi otomatis nyari ukuran yang muat sendiri.
      if (res.status === 413) {
        if (files.length <= 1) {
          return {
            ok: false,
            error: `File "${files[0]?.path}" sendirian aja udah kelewat batas ukuran request (413). Coba kompres file ini dulu sebelum upload.`,
          };
        }

        onRetry("splitting", attempt, 0);
        const mid = Math.ceil(files.length / 2);
        const firstHalf = files.slice(0, mid);
        const secondHalf = files.slice(mid);

        const r1: UploadChunkResult = await uploadChunkWithRetry(
          owner, repo, branch, message, firstHalf, onRetry, isCancelled
        );
        if (!r1.ok) return r1;

        const r2: UploadChunkResult = await uploadChunkWithRetry(
          owner, repo, branch, message, secondHalf, onRetry, isCancelled
        );
        if (r2.ok === false) {
          // Separuh pertama tetap kehitung berhasil walau separuh kedua
          // gagal — biar gak nge-hitung ulang file yang emang udah kecommit.
          // Di-cast eksplisit (bukan cuma andelin "if (!r2.ok)" buat
          // mempersempit union) biar gak gampang gagal compile lagi kayak
          // sebelumnya — beberapa versi TypeScript kadang gak mempersempit
          // union hasil pemanggilan fungsi REKURSIF semulus variabel biasa.
          const failed = r2 as { ok: false; error: string; cancelled?: boolean };
          return {
            ok: false,
            error: failed.error,
            cancelled: failed.cancelled,
          };
        }

        return {
          ok: true,
          skippedCount: r1.skippedCount + r2.skippedCount,
          uploadedCount: r1.uploadedCount + r2.uploadedCount,
        };
      }

      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          ok: true,
          skippedCount: d.skippedCount || 0,
          uploadedCount: d.uploadedCount ?? files.length,
        };
      }
      lastError = d.error || `HTTP ${res.status}`;

      // Error ASLI (bukan soal sinyal) -> berhenti, retry gak bakal nolong.
      if (!isTransientStatus(res.status)) {
        return { ok: false, error: lastError };
      }
    } catch (e: any) {
      // fetch throw (TypeError "Failed to fetch" dll) = koneksi putus di
      // tengah jalan -> dianggap masalah sinyal, terus di-retry.
      lastError = e?.message || "Koneksi terputus";
    }

    // Backoff diperlambat progresif tapi DI-CAP 30 detik (bukan nyerah) —
    // sinyal goyang lama tetap terus dicoba, cuma jaraknya makin lebar biar
    // gak nge-spam request pas kondisi lagi jelek.
    const waitMs = Math.min(30000, attempt * 3000);
    onRetry("backoff", attempt, waitMs);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

// Bentuk generik buat 1 file yang mau di-upload, apapun asalnya (input
// biasa, folder, atau hasil ekstrak ZIP) — biar validasi/filter-nya cuma
// ditulis SEKALI di processEntries, gak diduplikasi 3x.
type PendingFile = {
  relPath: string;
  size: number;
  getBase64: () => Promise<string>;
};

export default function UploadButton({
  owner,
  repo,
  branch,
  currentFolder,
  onDone,
}: {
  owner: string;
  repo: string;
  branch: string;
  currentFolder: string; // path folder tujuan di file tree, "" = root
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const childFolderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const deleteExtractZipInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  // Dipakai buat "Batalkan" pas lagi nunggu/retry — karena sekarang retry
  // gak dibatasin jumlahnya (biar tahan sinyal goyang), harus ada jalan
  // keluar manual buat user.
  const cancelRef = useRef(false);
  const { status: plusStatus } = usePlusStatus();
  const isPlus = !!plusStatus?.active;
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Dipanggil dari tombol "Upload Child Folder Utama" / "Upload ZIP" — kalau
  // belum Plus, buka modal upgrade instead of buka file picker.
  function requirePlus(action: () => void) {
    if (!isPlus) {
      setOpen(false);
      setShowUpgrade(true);
      return;
    }
    action();
  }

  // ==== Logika inti (filter, cek rahasia, cek ukuran, kirim ke API) — ====
  // ==== dipakai bareng oleh upload file biasa, folder, child folder, ====
  // ==== dan ZIP.                                                     ====
  async function processEntries(rawEntries: PendingFile[]) {
    cancelRef.current = false;
    try {
      const afterIgnoreFilter = includeAll
        ? rawEntries
        : rawEntries.filter((e) => !shouldIgnore(e.relPath));

      const secretEntries = afterIgnoreFilter.filter((e) => isSecretFile(e.relPath));
      let entries = afterIgnoreFilter;

      if (secretEntries.length > 0) {
        const names = secretEntries.map((e) => e.relPath).join(", ");
        const includeSecrets = confirm(
          `Ditemukan file environment (${names}) yang biasanya berisi kredensial/API key rahasia.\n\n` +
          `Kalau repo ini PUBLIC, siapa saja bisa lihat & pakai kredensial itu.\n\n` +
          `Tetap upload file ini juga?`
        );
        if (!includeSecrets) {
          entries = afterIgnoreFilter.filter((e) => !secretEntries.includes(e));
        }
      }

      if (entries.length === 0) {
        alert("Tidak ada file yang bisa di-upload.");
        return;
      }

      // GitHub keras nolak file > 100MB, dan file besar bikin browser berat.
      const bigFiles = entries.filter((e) => e.size > 100 * 1024 * 1024);
      if (bigFiles.length > 0) {
        const names = bigFiles.map((e) => e.relPath).join(", ");
        alert(
          `File ini lebih dari 100MB dan akan DITOLAK GitHub, jadi otomatis di-skip: ${names}\n\n` +
          `Untuk file sebesar ini, GitHub sarankan pakai Git LFS (belum didukung app ini).`
        );
        entries = entries.filter((e) => !bigFiles.includes(e));
      }

      const warnFiles = entries.filter((e) => e.size > 25 * 1024 * 1024);
      if (warnFiles.length > 0) {
        const proceed = confirm(
          `${warnFiles.length} file berukuran di atas 25MB. Proses upload bisa lemot, terutama di HP. Lanjut?`
        );
        if (!proceed) return;
      }

      if (entries.length === 0) return;

      const skipped = rawEntries.length - entries.length;

      if (entries.length > 300) {
        const proceed = confirm(
          `Kamu mau upload ${entries.length} file sekaligus. GitHub API bisa rate-limit kalau kebanyakan dalam 1 commit. Lanjut tetap coba?`
        );
        if (!proceed) return;
      }

      setProgress(`Membaca ${entries.length} file${skipped ? ` (${skipped} di-skip)` : ""}...`);

      const payload = await Promise.all(
        entries.map(async (e) => {
          const targetPath = currentFolder ? `${currentFolder}/${e.relPath}` : e.relPath;
          const base64 = await e.getBase64();
          return { path: targetPath, content: base64, isBase64: true };
        })
      );

      setProgress(`Meng-upload ${payload.length} file ke GitHub...`);

      const quality = detectConnectionQuality();
      const { maxFiles, maxBytes } = chunkParamsFor(quality);
      const chunks = splitIntoChunks(payload, maxFiles, maxBytes);

      if (chunks.length > 1) {
        setProgress(
          `Sinyal terdeteksi ${QUALITY_LABEL[quality]} — upload dipecah jadi ${chunks.length} bagian biar aman...`
        );
        await new Promise((r) => setTimeout(r, 900)); // kasih waktu user baca pesannya
      }

      let uploadedSoFar = 0;
      let skippedTotal = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkMessage =
          chunks.length > 1
            ? `Upload ${payload.length} file via KRYNOS (bagian ${i + 1}/${chunks.length})`
            : `Upload ${payload.length} file via KRYNOS`;

        setProgress(
          chunks.length > 1
            ? `Bagian ${i + 1}/${chunks.length} — ${chunk.length} file...`
            : `Meng-upload ${payload.length} file ke GitHub...`
        );

        const result = await uploadChunkWithRetry(
          owner,
          repo,
          branch,
          chunkMessage,
          chunk,
          (status, attempt, waitMs) => {
            setProgress(
              status === "offline"
                ? `Bagian ${i + 1}/${chunks.length} — koneksi terputus, menunggu sinyal balik...`
                : status === "splitting"
                ? `Bagian ${i + 1}/${chunks.length} — batch kegedean (413), otomatis dibelah jadi lebih kecil...`
                : `Bagian ${i + 1}/${chunks.length} — sinyal goyang, diperlambat & dicoba lagi (percobaan ke-${attempt}, jeda ${Math.round(waitMs / 1000)}d)...`
            );
          },
          () => cancelRef.current
        );

        if (result.ok === false) {
          const doneMsg =
            uploadedSoFar > 0
              ? `${uploadedSoFar} dari ${payload.length} file udah berhasil ke-commit sebelum ini berhenti.`
              : `Belum ada file yang ke-upload.`;

          if (result.cancelled) {
            setProgress("");
            if (uploadedSoFar > 0) onDone();
            return;
          }

          // Bukan soal sinyal (server nolak beneran) -> gak ada gunanya
          // retry otomatis lagi, kasih tau usernya & berhenti.
          alert(
            `Upload berhenti di bagian ${i + 1}/${chunks.length}: ${result.error}\n\n${doneMsg}\n\n` +
            `Ini bukan soal sinyal — cek lagi isi/nama file yang diupload.`
          );
          if (uploadedSoFar > 0) onDone(); // refresh tree biar yang udah kecommit kelihatan
          return;
        }

        uploadedSoFar += result.uploadedCount;
        skippedTotal += result.skippedCount;
      }

      // Kasih tau kalau ada file yang isinya sama persis kayak yang udah ada
      // (server otomatis skip, gak ikut ke-upload/ke-commit) — biar user
      // ngerti kenapa jumlah perubahan di commit bisa lebih kecil dari
      // jumlah file yang dipilih.
      if (skippedTotal > 0) {
        setProgress(
          `Selesai — ${uploadedSoFar} file ke-upload, ${skippedTotal} file dilewati (isinya sama persis, gak perlu upload ulang).`
        );
        await new Promise((r) => setTimeout(r, 1800));
      }

      onDone();
    } finally {
      setUploading(false);
      setProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (childFolderInputRef.current) childFolderInputRef.current.value = "";
      if (zipInputRef.current) zipInputRef.current.value = "";
      if (deleteExtractZipInputRef.current) deleteExtractZipInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Upload File / Upload Gambar / Upload Folder (BIASA — nama folder tetap
  // ikut jadi prefix path, ga berubah dari sebelumnya)
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setOpen(false);
    const files = Array.from(fileList);
    const entries: PendingFile[] = files.map((f) => ({
      relPath: (f as any).webkitRelativePath || f.name,
      size: f.size,
      getBase64: () => readAsBase64(f),
    }));
    await processEntries(entries);
  }

  // Upload Child Folder Utama — folder yang dipilih user JANGAN ikut jadi
  // prefix, cuma isinya (child) yang di-upload. "project/src/a.js" -> "src/a.js"
  async function handleChildFolderFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setOpen(false);
    const files = Array.from(fileList);
    const entries: PendingFile[] = files.map((f) => ({
      relPath: stripTopLevelFolder((f as any).webkitRelativePath || f.name),
      size: f.size,
      getBase64: () => readAsBase64(f),
    }));
    await processEntries(entries);
  }

  // Upload ZIP — ekstrak di browser (JSZip). Kalau SEMUA file di dalam ZIP
  // sama-sama berada di bawah 1 folder pembungkus yang sama persis (pola
  // umum ZIP dari GitHub/StackBlitz dkk: "nama-project-main/..."), folder
  // pembungkus itu di-skip, yang di-upload cuma childnya. Kalau file-nya
  // memang tersebar di root ZIP (gak ada folder pembungkus tunggal), gak
  // ada yang di-strip — upload apa adanya.
  async function handleZipFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setOpen(false);
    setProgress("Membaca isi ZIP...");
    try {
      const entries = await readZipEntries(file);
      setProgress(`Mengekstrak ${entries.length} file dari ZIP...`);
      await processEntries(entries);
    } catch (err: any) {
      alert("Gagal membaca file ZIP: " + (err?.message || "format ZIP tidak valid/rusak"));
      setUploading(false);
      setProgress("");
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  }

  // Delete & Extract Zip — mode SYNC: file yang ADA di ZIP bakal
  // ditulis/diperbarui (yang isinya udah sama persis otomatis di-skip sama
  // endpoint upload, gak perlu disentuh dua kali), sementara file yang ADA
  // di repo/folder ini tapi GAK ADA di ZIP bakal DIHAPUS (misal README.md
  // lama yang gak ke-include lagi di ZIP baru). Jadi bukan "hapus semua
  // baru upload ulang semua" — cuma beres-beres yang emang perlu.
  async function handleDeleteAndExtractZip(file: File | null) {
    if (!file) return;

    const scopeLabel = currentFolder ? `folder "${currentFolder}"` : "SELURUH REPO INI (root)";
    const confirmed = confirm(
      `Ini bakal nyamain isi ${scopeLabel} persis kayak isi ZIP:\n\n` +
      `• File yang ADA di ZIP -> ditulis/diperbarui (yang isinya udah sama persis gak disentuh)\n` +
      `• File yang GAK ADA di ZIP tapi ada di ${scopeLabel} -> DIHAPUS\n\n` +
      `Proses hapusnya TIDAK BISA DIBATALKAN. Yakin lanjut?`
    );
    if (!confirmed) {
      if (deleteExtractZipInputRef.current) deleteExtractZipInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setOpen(false);

    try {
      // Baca & validasi ZIP-nya DULU sebelum mulai hapus apapun — kalau
      // ZIP-nya rusak/kosong, mending gagal di sini daripada udah kadung
      // ngehapus file yang gak ke-cover ZIP tapi extract-nya gagal.
      setProgress("Membaca isi ZIP...");
      const entries = await readZipEntries(file);

      // Ini daftar path TUJUAN AKHIR semua file di ZIP (setelah di-prefix
      // currentFolder) — dipakai sebagai "daftar yang harus tetap ada",
      // biar endpoint hapus tau persis mana yang boleh disentuh.
      const keepPaths = entries.map((e) =>
        currentFolder ? `${currentFolder}/${e.relPath}` : e.relPath
      );

      setProgress(`Menyamakan isi ${scopeLabel} dengan ZIP...`);
      const deleteRes = await fetch(`/api/github/repo/${owner}/${repo}/tree-delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          currentFolder
            ? {
                path: currentFolder,
                branch,
                keepPaths,
                message: `Sync ${currentFolder} dengan ZIP (hapus file yang gak ada di ZIP)`,
              }
            : {
                deleteAll: true,
                branch,
                keepPaths,
                message: "Sync repo dengan ZIP (hapus file yang gak ada di ZIP)",
              }
        ),
      });

      if (!deleteRes.ok) {
        const d = await deleteRes.json().catch(() => ({}));
        // "Tidak ditemukan" artinya folder/repo emang udah kosong -> bukan
        // masalah, lanjut aja ke extract. Selain itu, beneran gagal, stop.
        if (deleteRes.status !== 404) {
          throw new Error(d.error || "Gagal menyamakan file yang ada dengan ZIP");
        }
      } else {
        const d = await deleteRes.json().catch(() => ({}));
        if (typeof d.deletedCount === "number" && d.deletedCount > 0) {
          setProgress(`${d.deletedCount} file lama dihapus (gak ada di ZIP)...`);
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      setProgress(`Mengekstrak ${entries.length} file dari ZIP...`);
      await processEntries(entries);
    } catch (err: any) {
      alert("Delete & Extract Zip gagal: " + (err?.message || "terjadi kesalahan"));
      setUploading(false);
      setProgress("");
      if (deleteExtractZipInputRef.current) deleteExtractZipInputRef.current.value = "";
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          disabled={uploading}
          className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-3 py-1.5 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
        >
          <FaUpload size={11} />
          {uploading ? progress || "Uploading..." : "Upload"}
        </button>
        {uploading && (
          <button
            onClick={() => {
              cancelRef.current = true;
              setProgress("Membatalkan...");
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-red-500/40 text-red-400 active:scale-95"
          >
            Batalkan
          </button>
        )}
      </div>

      {open && !uploading && (
        <div className="absolute right-0 mt-1 w-64 bg-panel border border-border rounded-lg shadow-xl z-20 overflow-hidden">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5"
          >
            <FaFileUpload size={12} /> Upload File
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border"
          >
            <FaImage size={12} /> Upload Gambar
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border"
          >
            <FaFolderPlus size={12} /> Upload Folder
          </button>
          <button
            onClick={() => requirePlus(() => childFolderInputRef.current?.click())}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border text-left"
          >
            <FaFolderOpen size={12} className="mt-0.5 shrink-0" />
            <span className="flex-1">Upload Child Folder Utama</span>
            {!isPlus && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0">
                <FaLock size={9} /> Plus
              </span>
            )}
          </button>
          <button
            onClick={() => requirePlus(() => zipInputRef.current?.click())}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border text-left"
          >
            <FaFileArchive size={12} className="mt-0.5 shrink-0" />
            <span className="flex-1">Extract Zip</span>
            {!isPlus && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0">
                <FaLock size={9} /> Plus
              </span>
            )}
          </button>
          <button
            onClick={() => requirePlus(() => deleteExtractZipInputRef.current?.click())}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-sm hover:bg-white/5 border-t border-border text-left"
          >
            <FaTrashAlt size={12} className="mt-0.5 shrink-0 text-red-400" />
            <span className="flex-1">
              Delete &amp; Extract Zip
              <span className="block text-[10px] text-gray-500">Samain isi folder dengan ZIP (yang gak ada di ZIP dihapus)</span>
            </span>
            {!isPlus && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0">
                <FaLock size={9} /> Plus
              </span>
            )}
          </button>
          <label className="flex items-start gap-2 px-3 py-2.5 text-xs border-t border-border cursor-pointer">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="accent-accent mt-0.5"
            />
            <span>
              Upload semua file
              <span className="block text-gray-500">termasuk node_modules, .next, .git</span>
            </span>
          </label>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - atribut non-standar tapi didukung browser modern untuk pilih folder
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={childFolderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => handleChildFolderFiles(e.target.files)}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => handleZipFile(e.target.files?.[0] || null)}
      />
      <input
        ref={deleteExtractZipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => handleDeleteAndExtractZip(e.target.files?.[0] || null)}
      />
      {showUpgrade && <PlusUpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
