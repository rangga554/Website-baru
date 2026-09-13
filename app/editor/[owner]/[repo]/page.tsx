"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CodeEditor from "@/components/CodeEditor";
import PlainTextEditor from "@/components/PlainTextEditor";
import FileToolbarMenu from "@/components/FileToolbarMenu";
import FileTree from "@/components/FileTree";
import FileActionSheet from "@/components/FileActionSheet";
import { downloadBlob } from "@/lib/nativeDownload";
import BranchSelector from "@/components/BranchSelector";
import UploadButton from "@/components/UploadButton";
import RepoSettings from "@/components/RepoSettings";
import IssuesPanel from "@/components/IssuesPanel";
import ReleasesPanel from "@/components/ReleasesPanel";
import LogsPanel from "@/components/LogsPanel";
import CopyModal from "@/components/CopyModal";
import TestPanel from "@/components/TestPanel";
import ImageViewer from "@/components/ImageViewer";
import AudioPlayer from "@/components/AudioPlayer";
import VideoPlayer from "@/components/VideoPlayer";
import VideoLinkPlayer from "@/components/VideoLinkPlayer";
import CopyContentButton from "@/components/CopyContentButton";
import { buildFileTree, Branch, TreeItem, FileNode } from "@/types";
import { useIsTouchDevice } from "@/lib/useIsTouchDevice";

// atob() polos cuma bener buat base64 yang isinya ASCII/Latin-1. Karakter
// Unicode multi-byte (misal em dash "—", emoji, dll) jadi rusak/mojibake
// (kebaca kayak "â€"") kalau langsung di-atob doang, soalnya tiap byte
// diperlakuin sebagai 1 karakter, padahal UTF-8 pakai beberapa byte buat
// 1 karakter. TextDecoder("utf-8") di bawah ini yang betulin.
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
import {
  FaBars, FaTimes, FaSave, FaFileMedical, FaFolderPlus,
  FaTrash, FaArrowLeft, FaCog, FaExclamationCircle, FaTag, FaCode,
  FaHistory, FaDownload, FaCopy, FaEye, FaFlask, FaStop, FaEdit, FaEllipsisV, FaBoxOpen, FaFilm,
} from "react-icons/fa";

type Tab = "files" | "issues" | "releases" | "settings" | "logs";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
function isImagePath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXT.includes(ext);
}

const HTML_EXT = ["html", "htm"];
function isHtmlPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return HTML_EXT.includes(ext);
}

// Sama persis konsepnya kayak gambar (IMAGE_EXT/isImagePath) — file musik
// itu binary, jadi harus ditangani beda dari file teks: base64 mentahnya
// disimpen langsung (BUKAN di-decode jadi teks kayak source code), terus
// ditampilin lewat <AudioPlayer> yang punya tombol play beneran buat
// nge-tes langsung di browser tanpa perlu download dulu.
const AUDIO_EXT = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "weba", "webm"];
function isAudioPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return AUDIO_EXT.includes(ext);
}
const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  webm: "audio/webm",
};

// Sama konsepnya kayak audio — browser <video> tag udah bisa stream sendiri
// dari endpoint /raw, jadi gak perlu library player tambahan.
const VIDEO_EXT = ["mp4", "mov", "m4v", "mkv", "avi", "3gp"];
function isVideoPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return VIDEO_EXT.includes(ext);
}
const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  "3gp": "video/3gpp",
};

// File ".videolink" ISINYA cuma teks 1 baris (link Google Drive/URL video),
// BUKAN video aslinya — jadi ukurannya selalu kecil banget, upload/save-nya
// otomatis lewat jalur teks biasa (gak pernah kena limit ukuran/413 kayak
// upload video asli). Video besar disimpen di Google Drive/hosting lain,
// repo cuma nyimpen "petunjuk"-nya doang.
function isVideoLinkPath(path: string) {
  return path.toLowerCase().endsWith(".videolink");
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

export default function EditorPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const { owner, repo } = params;
  const { status } = useSession();
  const router = useRouter();

  const [repoInfo, setRepoInfo] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("");
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeSha, setActiveSha] = useState<string | undefined>(undefined);
  // File yang dibuka defaultnya cuma PREVIEW (read-only, syntax-highlighted).
  // Baru masuk mode edit (textarea native) kalau user pencet "Edit File" di
  // menu titik-tiga — biar copy/paste pakai keyboard bawaan HP, bukan
  // clipboard custom Monaco.
  const [editMode, setEditMode] = useState(false);
  const [htmlPreviewMode, setHtmlPreviewMode] = useState(false);
  const [uploadingExtract, setUploadingExtract] = useState<string | null>(null);
  const [extractingRepoZip, setExtractingRepoZip] = useState(false);
  // PC/laptop (mouse+keyboard) -> Monaco tetap dipakai pas edit, biar syntax
  // highlighting jalan terus. HP/tablet (touch) -> tetap textarea polos,
  // karena Monaco suka bentrok sama clipboard/keyboard bawaan touch device.
  const isTouchDevice = useIsTouchDevice();
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [actionNode, setActionNode] = useState<FileNode | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [changingImage, setChangingImage] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [changingAudio, setChangingAudio] = useState(false);
  const [changingVideo, setChangingVideo] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const searchParams = useSearchParams();

  useEffect(() => {
    // Dipakai RepoSettings buat balik ke tab Settings setelah rename repo
    // (karena redirect ke URL baru bikin state tab lokal ke-reset).
    if (searchParams.get("tab") === "settings") setTab("settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [commitMsg, setCommitMsg] = useState("");
  const [showCommitBox, setShowCommitBox] = useState(false);
  const [showFork, setShowFork] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testPreviewUrl, setTestPreviewUrl] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [repoLoadError, setRepoLoadError] = useState<string | null>(null);
  const [treeLoadError, setTreeLoadError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);

  // repo bukan milik sendiri & gak ada akses tulis -> mode lihat-lihat aja
  const canEdit = repoInfo?.permissions?.push ?? true;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const loadRepoInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/settings`);
      if (res.ok) {
        const data = await res.json();
        setRepoInfo(data);
        setRepoLoadError(null);
        if (!branch) setBranch(data.default_branch);
      } else {
        const d = await res.json().catch(() => ({}));
        setRepoLoadError(
          d.error ||
            (res.status === 404
              ? "Repository tidak ditemukan (mungkin sudah dihapus/direname, atau kamu gak punya akses)"
              : `Gagal memuat repository (HTTP ${res.status})`)
        );
      }
    } catch (e: any) {
      setRepoLoadError(e?.message || "Gagal terhubung ke server. Cek koneksi internet kamu.");
    }
  }, [owner, repo, branch]);

  const loadBranches = useCallback(async () => {
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`);
      if (res.ok) setBranches(await res.json());
    } catch {
      // Gagal ambil daftar branch bukan fatal (branch aktif tetap kepakai
      // dari loadRepoInfo) — biarin aja, gak perlu blokir seluruh halaman.
    }
  }, [owner, repo]);

  const loadTree = useCallback(async () => {
    if (!branch) return;
    setTreeLoading(true);
    try {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/tree?ref=${encodeURIComponent(branch)}`
      );
      if (res.ok) {
        const data = await res.json();
        setTreeItems(data.tree || []);
        setTreeLoadError(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setTreeLoadError(d.error || `Gagal memuat daftar file (HTTP ${res.status})`);
      }
    } catch (e: any) {
      setTreeLoadError(e?.message || "Gagal terhubung ke server. Cek koneksi internet kamu.");
    } finally {
      setTreeLoading(false);
    }
  }, [owner, repo, branch]);

  useEffect(() => {
    if (status === "authenticated") {
      loadRepoInfo();
      loadBranches();
    }
  }, [status]);

  useEffect(() => {
    if (branch) loadTree();
  }, [branch, loadTree]);

  async function openFile(path: string) {
    setLoadingFile(true);
    setFileLoadError(null);
    setActivePath(path);
    setSidebarOpen(false);
    setImageBase64(null);
    setAudioBase64(null);
    setAudioSrc(null);
    setVideoBase64(null);
    setVideoSrc(null);
    setHtmlPreviewMode(false);
    setEditMode(false); // file baru selalu kebuka dalam mode Preview dulu
    const isAudio = isAudioPath(path);
    const isVideo = isVideoPath(path);
    // Musik & video: JANGAN narik isi filenya lewat /contents (base64
    // dibungkus JSON bikin ukuran bengkak ~33% dan bisa ketembus limit
    // ukuran response Vercel Functions buat file yang cukup besar — itu
    // penyebab file musik/video gagal diputar). Cukup ambil metadata-nya
    // (meta=1, buat dapetin sha), sementara isi filenya beneran diambil
    // browser langsung dari /raw (binary asli, gak lewat JSON) pas
    // <audio>/<video> di-render.
    const metaOnly = isAudio || isVideo;
    try {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/contents?path=${encodeURIComponent(
          path
        )}&ref=${encodeURIComponent(branch)}${metaOnly ? "&meta=1" : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        if (isImagePath(path)) {
          // gambar: JANGAN di-atob jadi teks, simpan base64 mentah buat ditampilkan sebagai <img>
          setImageBase64(data.content.replace(/\n/g, ""));
          setContent("");
          setOriginalContent("");
        } else if (isAudio) {
          const rawUrl = `/api/github/repo/${owner}/${repo}/raw?path=${encodeURIComponent(
            path
          )}&ref=${encodeURIComponent(branch)}`;
          setAudioBase64("1"); // penanda "file musik ada" buat toggle tombol Ganti/Tambah
          setAudioSrc(rawUrl);
          setContent("");
          setOriginalContent("");
        } else if (isVideo) {
          const rawUrl = `/api/github/repo/${owner}/${repo}/raw?path=${encodeURIComponent(
            path
          )}&ref=${encodeURIComponent(branch)}`;
          setVideoBase64("1"); // penanda "file video ada" buat toggle tombol Ganti/Tambah
          setVideoSrc(rawUrl);
          setContent("");
          setOriginalContent("");
        } else {
          const decoded =
            data.encoding === "base64"
              ? decodeBase64Utf8(data.content.replace(/\n/g, ""))
              : data.content;
          setContent(decoded);
          setOriginalContent(decoded);
        }
        setActiveSha(data.sha);
      } else {
        const d = await res.json().catch(() => ({}));
        setFileLoadError(d.error || `Gagal memuat file (HTTP ${res.status})`);
      }
    } catch (e: any) {
      setFileLoadError(e?.message || "Gagal terhubung ke server. Cek koneksi internet.");
    } finally {
      setLoadingFile(false);
    }
  }

  function cancelEdit() {
    if (isDirty && !confirm("Ada perubahan yang belum di-commit. Buang perubahan itu?")) {
      return;
    }
    setContent(originalContent);
    setEditMode(false);
  }

  async function saveFile() {
    if (!activePath) return;
    if (!commitMsg.trim()) {
      setShowCommitBox(true);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: activePath,
        content,
        message: commitMsg,
        branch,
        sha: activeSha,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setActiveSha(data.content.sha);
      setOriginalContent(content);
      setCommitMsg("");
      setShowCommitBox(false);
      setEditMode(false); // balik ke Preview abis commit
      loadTree();
    } else {
      const d = await res.json();
      alert("Gagal menyimpan: " + d.error);
    }
  }

  async function createNewFile() {
    const name = prompt("Path file baru, contoh: src/index.js");
    if (!name) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: name,
        content: "",
        message: `Create ${name}`,
        branch,
      }),
    });
    if (res.ok) {
      loadTree();
      openFile(name);
    } else {
      const d = await res.json();
      alert("Gagal: " + d.error);
    }
  }

  // Shortcut buat video berat: BUKAN upload file video (bisa kena 413 kalau
  // gede), cuma nyimpen link-nya (Google Drive/URL video lain) ke file kecil
  // berekstensi ".videolink". Videonya sendiri tetap di Drive, repo cuma
  // nyimpen teks link-nya doang.
  async function createVideoLink() {
    const name = prompt(
      "Nama file link video, contoh: trailer.videolink\n(otomatis ditambah .videolink kalau belum ada)"
    );
    if (!name) return;
    const path = name.toLowerCase().endsWith(".videolink") ? name : `${name}.videolink`;

    const url = prompt("Tempel link video-nya (Google Drive/URL video langsung):");
    if (!url) return;

    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        content: url.trim(),
        message: `Tambah link video ${path}`,
        branch,
      }),
    });
    if (res.ok) {
      loadTree();
      openFile(path);
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal: " + (d.error || "terjadi kesalahan"));
    }
  }

  async function createNewFolder() {
    const name = prompt("Nama folder baru, contoh: src/components");
    if (!name) return;
    // GitHub tidak punya folder kosong asli, jadi kita taruh file .gitkeep
    const path = `${name}/.gitkeep`;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        content: "",
        message: `Create folder ${name}`,
        branch,
      }),
    });
    if (res.ok) loadTree();
    else alert("Gagal membuat folder");
  }

  async function deleteActiveFile() {
    if (!activePath || !activeSha) return;
    if (!confirm(`Hapus file "${activePath}"?`)) return;
    const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: activePath,
        message: `Delete ${activePath}`,
        branch,
        sha: activeSha,
      }),
    });
    if (res.ok) {
      setActivePath(null);
      setContent("");
      loadTree();
    } else {
      alert("Gagal menghapus file");
    }
  }

  // Nama unik buat hasil duplikat, cek tabrakan ke treeItems yang sedang
  // dimuat (path persis buat file, atau path/prefix buat folder).
  function generateDuplicatePath(node: FileNode): string {
    const existingPaths = treeItems.map((i) => i.path);
    const collides = (candidate: string) =>
      existingPaths.some((p) => p === candidate || p.startsWith(`${candidate}/`));

    const lastSlash = node.path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? node.path.slice(0, lastSlash) : "";
    const name = node.path.slice(lastSlash + 1);

    let base: string;
    let ext = "";
    if (node.type === "file" && name.includes(".")) {
      const dot = name.lastIndexOf(".");
      base = name.slice(0, dot);
      ext = name.slice(dot); // termasuk titiknya
    } else {
      base = name;
    }

    let attempt = `${base} copy`;
    let n = 2;
    while (collides(dir ? `${dir}/${attempt}${ext}` : `${attempt}${ext}`)) {
      attempt = `${base} copy ${n}`;
      n++;
    }
    return dir ? `${dir}/${attempt}${ext}` : `${attempt}${ext}`;
  }

  async function extractZipNode(node: FileNode) {
    const deleteZipAfter = confirm(
      `Extract "${node.path}" di sini?\n\nOK = extract lalu hapus file .zip aslinya\nCancel = tetap extract, tapi .zip aslinya dibiarin`
    );
    // "confirm" cuma OK/Cancel, jadi dua-duanya tetap lanjut extract —
    // bedanya cuma delete-zip-after atau nggak. Kalau user pengen batal
    // total, gampang: tutup FileActionSheet-nya aja sebelum ini kepanggil.

    setUploadingExtract(node.path);
    try {
      const res = await fetch(`/api/github/repo/${owner}/${repo}/tree-extract-zip`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: node.path,
          branch,
          deleteZipAfter,
          message: `Extract ${node.path}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal extract ZIP");
      if (data.skippedCount > 0) {
        alert(
          `Selesai — ${data.extractedCount} file di-extract, ${data.skippedCount} file dilewati (isinya sama persis kayak yang udah ada).`
        );
      }
      loadTree();
    } catch (e: any) {
      alert("Gagal extract: " + e.message);
    } finally {
      setUploadingExtract(null);
    }
  }

  async function duplicateNode(node: FileNode) {
    const newPath = generateDuplicatePath(node);
    if (!confirm(`Duplikasi "${node.path}" jadi "${newPath}"?`)) return;

    const res = await fetch(`/api/github/repo/${owner}/${repo}/tree-duplicate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        newPath,
        branch,
        message: `Duplicate ${node.path} to ${newPath}`,
      }),
    });
    if (res.ok) {
      loadTree();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menduplikasi: " + (d.error || "unknown error"));
    }
  }

  async function deleteNode(node: FileNode) {
    const warning =
      node.type === "folder"
        ? `Hapus folder "${node.path}" beserta SEMUA isinya? Tindakan ini tidak bisa dibatalkan.`
        : `Hapus file "${node.path}"? Tindakan ini tidak bisa dibatalkan.`;
    if (!confirm(warning)) return;

    const res = await fetch(`/api/github/repo/${owner}/${repo}/tree-delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: node.path,
        branch,
        message: `Delete ${node.path}`,
      }),
    });
    if (res.ok) {
      // Kalau file yang lagi kebuka di editor ada di dalam yang barusan
      // dihapus (persis, atau ada di dalam folder yang dihapus), tutup
      // editornya juga.
      if (activePath === node.path || activePath?.startsWith(`${node.path}/`)) {
        setActivePath(null);
        setContent("");
      }
      loadTree();
    } else {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menghapus: " + (d.error || "unknown error"));
    }
  }

  async function renameActiveFile() {
    if (!activePath) return;
    const newPath = prompt("Path baru buat file ini:", activePath);
    if (!newPath || newPath === activePath) return;
    if (!confirm(`Pindahkan "${activePath}" ke "${newPath}"?`)) return;

    setRenaming(true);
    try {
      // GitHub gak punya operasi "rename" langsung, jadi caranya: baca ulang
      // isi file dari sumbernya (bukan dari state, biar aman buat file
      // apapun termasuk gambar/binary), bikin file baru di path baru dengan
      // isi yang sama, baru hapus file lama.
      const getRes = await fetch(
        `/api/github/repo/${owner}/${repo}/contents?path=${encodeURIComponent(
          activePath
        )}&ref=${encodeURIComponent(branch)}`
      );
      if (!getRes.ok) throw new Error("Gagal membaca file sumber");
      const fileData = await getRes.json();

      const putRes = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: newPath,
          content: (fileData.content || "").replace(/\n/g, ""),
          isBase64: true,
          message: `Rename ${activePath} to ${newPath}`,
          branch,
        }),
      });
      if (!putRes.ok) {
        const d = await putRes.json();
        throw new Error(d.error || "Gagal membuat file di path baru");
      }

      const delRes = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: activePath,
          message: `Rename ${activePath} to ${newPath}`,
          branch,
          sha: fileData.sha,
        }),
      });
      if (!delRes.ok) {
        const d = await delRes.json();
        throw new Error(
          (d.error || "Gagal menghapus file lama") +
            " — file baru sudah dibuat, file lama perlu dihapus manual."
        );
      }

      await loadTree();
      await openFile(newPath);
    } catch (e: any) {
      alert("Gagal rename: " + (e?.message || "Terjadi kesalahan"));
    } finally {
      setRenaming(false);
    }
  }

  async function changeImage(file: File | null) {
    if (!file || !activePath) return;
    setChangingImage(true);
    try {
      const base64 = await readAsBase64(file);
      const isFirstUpload = !imageBase64;
      const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: activePath,
          content: base64,
          isBase64: true,
          message: isFirstUpload
            ? `Tambah gambar ${activePath}`
            : `Ganti gambar ${activePath}`,
          branch,
          sha: activeSha,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setImageBase64(base64);
        setActiveSha(data.content.sha);
        loadTree();
      } else {
        const d = await res.json().catch(() => ({}));
        alert("Gagal simpan gambar: " + (d.error || `HTTP ${res.status}`));
      }
    } catch (e: any) {
      alert("Gagal simpan gambar: " + (e?.message || "cek koneksi internet."));
    } finally {
      setChangingImage(false);
    }
  }

  // Sama persis pola-nya kayak changeImage — upload/ganti file musik ke path
  // yang lagi dibuka. isFirstUpload nentuin pesan commit "Tambah" vs "Ganti".
  async function changeAudio(file: File | null) {
    if (!file || !activePath) return;
    setChangingAudio(true);
    try {
      const base64 = await readAsBase64(file);
      const isFirstUpload = !audioBase64;
      const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: activePath,
          content: base64,
          isBase64: true,
          message: isFirstUpload
            ? `Tambah musik ${activePath}`
            : `Ganti musik ${activePath}`,
          branch,
          sha: activeSha,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Baru upload -> base64-nya udah ada di memori browser (dari
        // FileReader lokal), jadi aman langsung dijadiin data: URL buat
        // preview instan tanpa perlu narik ulang dari server.
        const ext = activePath.split(".").pop()?.toLowerCase() || "mp3";
        const mime = AUDIO_MIME_BY_EXT[ext] || "audio/mpeg";
        setAudioBase64("1");
        setAudioSrc(`data:${mime};base64,${base64}`);
        setActiveSha(data.content.sha);
        loadTree();
      } else {
        const d = await res.json().catch(() => ({}));
        alert("Gagal simpan musik: " + (d.error || `HTTP ${res.status}`));
      }
    } catch (e: any) {
      alert("Gagal simpan musik: " + (e?.message || "cek koneksi internet."));
    } finally {
      setChangingAudio(false);
    }
  }

  // Sama persis pola-nya kayak changeAudio, buat file video.
  // Video ukurannya sering lebih gede dari gambar/musik biasa — base64-nya
  // dikirim sebagai 1 request JSON gede ke server, dan makin gede filenya,
  // makin gampang KEPUTUS di tengah jalan (timeout/koneksi gak stabil) SAAT
  // proses uploadnya SEBENERNYA udah berhasil ke GitHub (server-nya tetep
  // lanjut ngerjain walau koneksi client udah putus). Itu penyebab "kadang
  // error tapi refresh normal" — browser-nya doang yang gagal DAPET
  // respons-nya, bukan upload-nya beneran gagal.
  //
  // Makanya di sini: (1) retry otomatis 2x kalau errornya keliatan kayak
  // masalah koneksi/timeout, (2) kalau tetep gagal setelah semua retry,
  // CEK DULU ke GitHub apakah sha-nya udah berubah (artinya sebenernya
  // udah kesimpen) sebelum beneran nunjukin pesan gagal ke user.
  async function changeVideo(file: File | null) {
    if (!file || !activePath) return;
    setChangingVideo(true);
    try {
      const base64 = await readAsBase64(file);
      const isFirstUpload = !videoBase64;
      const shaBeforeUpload = activeSha;
      const message = isFirstUpload ? `Tambah video ${activePath}` : `Ganti video ${activePath}`;

      const MAX_ATTEMPTS = 3;
      let lastErrorMsg = "";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`/api/github/repo/${owner}/${repo}/contents`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              path: activePath,
              content: base64,
              isBase64: true,
              message,
              branch,
              sha: activeSha,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const ext = activePath.split(".").pop()?.toLowerCase() || "mp4";
            const mime = VIDEO_MIME_BY_EXT[ext] || "video/mp4";
            setVideoBase64("1");
            setVideoSrc(`data:${mime};base64,${base64}`);
            setActiveSha(data.content.sha);
            loadTree();
            return; // sukses, berhenti di sini
          }

          const d = await res.json().catch(() => ({}));
          lastErrorMsg = d.error || `HTTP ${res.status}`;
          // Error dari server (bukan network) kayak "sha gak cocok" itu gak
          // akan ke-fix cuma dengan diulang — langsung berhenti retry.
          if (res.status < 500) break;
        } catch (e: any) {
          // fetch() throw = kemungkinan besar network/timeout — ini yang
          // paling worth di-retry.
          lastErrorMsg = e?.message || "koneksi terputus";
        }

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
      }

      // Semua percobaan gagal DAPET RESPONS yang jelas — sebelum nunjukin
      // "gagal" ke user, cek dulu beneran ke GitHub: kalau sha file ini
      // udah beda dari sebelum upload, berarti sebenernya BERHASIL (server
      // sempet kelar ngerjain walau responnya gak nyampe ke browser).
      try {
        const checkRes = await fetch(
          `/api/github/repo/${owner}/${repo}/contents?path=${encodeURIComponent(
            activePath
          )}&ref=${encodeURIComponent(branch)}&meta=1`
        );
        if (checkRes.ok) {
          const meta = await checkRes.json();
          if (meta.sha && meta.sha !== shaBeforeUpload) {
            // Ternyata beneran udah kesimpen — anggep sukses, jangan alert.
            const ext = activePath.split(".").pop()?.toLowerCase() || "mp4";
            const mime = VIDEO_MIME_BY_EXT[ext] || "video/mp4";
            setVideoBase64("1");
            setVideoSrc(`data:${mime};base64,${base64}`);
            setActiveSha(meta.sha);
            loadTree();
            return;
          }
        }
      } catch {
        // Gagal cek ulang juga -> lanjut ke alert error di bawah, gak ada
        // cara lain buat mastiin.
      }

      alert(
        "Gagal simpan video: " +
          lastErrorMsg +
          "\n\nKalau video ini beneran gede, coba refresh halaman dulu buat cek — mungkin sebenernya udah kesimpen."
      );
    } finally {
      setChangingVideo(false);
    }
  }

  async function createBranch(newName: string) {
    const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newBranch: newName, fromBranch: branch }),
    });
    if (res.ok) {
      await loadBranches();
      setBranch(newName);
    } else {
      const d = await res.json();
      alert("Gagal buat branch: " + d.error);
    }
  }

  async function handleExtractToZip() {
    setExtractingRepoZip(true);
    try {
      const res = await fetch(
        `/api/github/repo/${owner}/${repo}/download-zip?branch=${encodeURIComponent(branch)}`
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Gagal membuat ZIP");
      }
      const blob = await res.blob();
      await downloadBlob(blob, `${repo}-${branch}.zip`);
    } catch (e: any) {
      alert("Gagal extract ke ZIP: " + e.message);
    } finally {
      setExtractingRepoZip(false);
    }
  }

  const fileTree = buildFileTree(treeItems);
  const isDirty = content !== originalContent;

  if (status !== "authenticated") return null;

  // Belum ada info repo sama sekali & lagi gagal -> tampilin error + tombol
  // coba lagi, JANGAN biarin halaman keliatan "loading selamanya" tanpa
  // penjelasan (ini yang bikin kesan macet padahal sebenarnya udah gagal).
  if (!repoInfo && repoLoadError) {
    return (
      <div className="h-dvh flex items-center justify-center bg-base px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-400 mb-4">{repoLoadError}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setRepoLoadError(null);
                loadRepoInfo();
                loadBranches();
              }}
              className="bg-accent px-4 py-2 rounded-lg text-sm font-medium"
            >
              Coba Lagi
            </button>
            <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm border border-border">
              Kembali
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Belum ada info repo & belum ada error -> beneran masih loading pertama
  // kali, kasih spinner yang jelas (bukan halaman kosong).
  if (!repoInfo) {
    return (
      <div className="h-dvh flex items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Memuat project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-base">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-panel shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-1 lg:hidden"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <Link href="/dashboard" className="hidden lg:flex p-2 -ml-1 text-gray-400">
            <FaArrowLeft />
          </Link>
          <span className="text-sm font-semibold truncate">{repo}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTest(true)}
            title="Test project (GitHub Actions)"
            className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm active:scale-95"
          >
            <FaFlask size={11} className="text-green-400" />
            <span className="hidden sm:inline">Test</span>
          </button>
          {canEdit && repoInfo && (
            <button
              onClick={handleExtractToZip}
              disabled={extractingRepoZip}
              title="Extract semua file di repo ini jadi 1 file ZIP"
              className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
            >
              <FaDownload size={11} />
              <span className="hidden sm:inline">
                {extractingRepoZip ? "Membuat ZIP..." : "Extract Your File To Zip"}
              </span>
            </button>
          )}
          {!canEdit && repoInfo && (
            <>
              <a
                href={`https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`}
                target="_blank"
                rel="noopener noreferrer"
                title="Download ZIP"
                className="flex items-center gap-1.5 bg-panel border border-border rounded-lg px-2.5 py-1.5 text-xs sm:text-sm"
              >
                <FaDownload size={11} />
                <span className="hidden sm:inline">ZIP</span>
              </a>
              <button
                onClick={() => setShowFork(true)}
                title="Copy repo ini ke akun saya"
                className="flex items-center gap-1.5 bg-accent rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium"
              >
                <FaCopy size={11} />
                <span className="hidden sm:inline">Copy</span>
              </button>
            </>
          )}
          {branches.length > 0 && (
            <BranchSelector
              branches={branches}
              current={branch}
              onChange={setBranch}
              onCreate={createBranch}
            />
          )}
        </div>
      </header>

      {!canEdit && repoInfo && (
        <div className="flex items-center gap-2 bg-yellow-950/40 border-b border-yellow-900/50 text-yellow-300 text-xs px-3 py-2 shrink-0">
          <FaEye size={11} className="shrink-0" />
          Mode lihat saja — kamu bukan pemilik repo ini. Pakai tombol <b>Copy</b> di atas
          buat nyalin ke akun kamu sendiri kalau mau edit.
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar (drawer di mobile, fixed di desktop) */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-80 lg:w-72 shrink-0
            bg-panel border-r border-border flex flex-col
            transition-transform duration-200 top-[49px] lg:top-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0 text-xs">
            <TabBtn active={tab === "files"} onClick={() => setTab("files")} icon={<FaCode size={12} />} label="Files" />
            <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon={<FaHistory size={12} />} label="Logs" />
            <TabBtn active={tab === "issues"} onClick={() => setTab("issues")} icon={<FaExclamationCircle size={12} />} label="Issues" />
            <TabBtn active={tab === "releases"} onClick={() => setTab("releases")} icon={<FaTag size={12} />} label="Release" />
            {canEdit && (
              <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<FaCog size={12} />} label="Setting" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "files" && (
              <>
                {canEdit && (
                  <div className="flex items-center gap-1.5 p-2 border-b border-border">
                    <button onClick={createNewFile} title="File baru" className="p-2 rounded-md hover:bg-white/5">
                      <FaFileMedical size={13} />
                    </button>
                    <button onClick={createNewFolder} title="Folder baru" className="p-2 rounded-md hover:bg-white/5">
                      <FaFolderPlus size={13} />
                    </button>
                    <button onClick={createVideoLink} title="Link Video (Google Drive/URL) — buat video berat" className="p-2 rounded-md hover:bg-white/5">
                      <FaFilm size={13} />
                    </button>
                    <div className="ml-auto">
                      <UploadButton
                        owner={owner}
                        repo={repo}
                        branch={branch}
                        currentFolder=""
                        onDone={loadTree}
                      />
                    </div>
                  </div>
                )}
                <div className="py-1">
                  <FileTree
                    nodes={fileTree}
                    activePath={activePath || undefined}
                    onSelectFile={openFile}
                    onAction={canEdit ? setActionNode : undefined}
                  />
                  {treeLoading && fileTree.length === 0 && (
                    <div className="flex flex-col items-center gap-2 mt-8">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">Memuat daftar file...</p>
                    </div>
                  )}
                  {!treeLoading && treeLoadError && (
                    <div className="text-center mt-6 px-4">
                      <p className="text-xs text-red-400 mb-2">{treeLoadError}</p>
                      <button onClick={loadTree} className="text-xs text-accent underline">
                        Coba lagi
                      </button>
                    </div>
                  )}
                  {!treeLoading && !treeLoadError && fileTree.length === 0 && (
                    <p className="text-xs text-gray-500 text-center mt-6 px-4">
                      Repository kosong. Buat file baru atau upload.
                    </p>
                  )}
                </div>
              </>
            )}
            {tab === "logs" && branch && <LogsPanel owner={owner} repo={repo} branch={branch} />}
            {tab === "issues" && <IssuesPanel owner={owner} repo={repo} />}
            {tab === "releases" && (
              <ReleasesPanel owner={owner} repo={repo} branches={branches.map((b) => b.name)} />
            )}
            {tab === "settings" && canEdit && repoInfo && (
              <RepoSettings owner={owner} repo={repo} info={repoInfo} onUpdated={loadRepoInfo} />
            )}
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden top-[49px]"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Editor area */}
        <main className="flex-1 min-w-0 flex flex-col">
          {activePath ? (
            <>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-panel/50 shrink-0">
                <span className="text-xs sm:text-sm text-gray-300 truncate">{activePath}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                {!isImagePath(activePath) && !isAudioPath(activePath) && !isVideoPath(activePath) && (
                  <CopyContentButton getText={() => content} iconOnly />
                )}
                {isHtmlPath(activePath) && !editMode && (
                  <button
                    onClick={() => setHtmlPreviewMode((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium border border-border text-gray-300 hover:bg-white/5 active:scale-95 shrink-0"
                    title={htmlPreviewMode ? "Balik ke kode" : "Preview tampilan HTML"}
                  >
                    {htmlPreviewMode ? "CODE" : "HTML"}
                  </button>
                )}
                {!(isHtmlPath(activePath) && htmlPreviewMode) && (
                isImagePath(activePath) ? (
                  canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer active:scale-95">
                        {changingImage ? (
                          "Menyimpan..."
                        ) : imageBase64 ? (
                          <>
                            <FaFileMedical size={11} /> Ganti Gambar
                          </>
                        ) : (
                          <>
                            <FaFileMedical size={11} /> Tambah Gambar
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={changingImage}
                          onChange={(e) => {
                            changeImage(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={renameActiveFile}
                        disabled={changingImage || renaming}
                        className="p-2 text-gray-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Rename file"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={deleteActiveFile}
                        disabled={changingImage}
                        className="p-2 text-red-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Hapus file"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )
                ) : isAudioPath(activePath) ? (
                  canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer active:scale-95">
                        {changingAudio ? (
                          "Menyimpan..."
                        ) : audioBase64 ? (
                          <>
                            <FaFileMedical size={11} /> Ganti Musik
                          </>
                        ) : (
                          <>
                            <FaFileMedical size={11} /> Tambah Musik
                          </>
                        )}
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={changingAudio}
                          onChange={(e) => {
                            changeAudio(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={renameActiveFile}
                        disabled={changingAudio || renaming}
                        className="p-2 text-gray-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Rename file"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={deleteActiveFile}
                        disabled={changingAudio}
                        className="p-2 text-red-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Hapus file"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )
                ) : isVideoPath(activePath) ? (
                  canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer active:scale-95">
                        {changingVideo ? (
                          "Menyimpan..."
                        ) : videoBase64 ? (
                          <>
                            <FaFileMedical size={11} /> Ganti Video
                          </>
                        ) : (
                          <>
                            <FaFileMedical size={11} /> Tambah Video
                          </>
                        )}
                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          disabled={changingVideo}
                          onChange={(e) => {
                            changeVideo(e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={renameActiveFile}
                        disabled={changingVideo || renaming}
                        className="p-2 text-gray-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Rename file"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={deleteActiveFile}
                        disabled={changingVideo}
                        className="p-2 text-red-400 hover:bg-white/5 rounded-md shrink-0 disabled:opacity-40"
                        title="Hapus file"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )
                ) : canEdit ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDirty && <span className="w-2 h-2 rounded-full bg-yellow-500" />}
                    {editMode ? (
                      <>
                        <button
                          onClick={cancelEdit}
                          className="p-2 text-gray-400 hover:bg-white/5 rounded-md"
                          title="Batal, balik ke Preview"
                        >
                          <FaTimes size={12} />
                        </button>
                        <button
                          onClick={saveFile}
                          disabled={!isDirty || saving}
                          className="flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium disabled:opacity-40"
                        >
                          <FaSave size={11} />
                          {saving ? "Menyimpan..." : "Commit"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowFileMenu(true)}
                        className="p-2 text-gray-300 hover:bg-white/5 rounded-md"
                        title="Opsi file"
                      >
                        <FaEllipsisV size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-500 flex items-center gap-1 shrink-0">
                    <FaEye size={10} /> read-only
                  </span>
                ))}
                </div>
              </div>

              {loadingFile ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
                  Memuat file...
                </div>
              ) : fileLoadError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
                  <p className="text-sm text-red-400">{fileLoadError}</p>
                  <button
                    onClick={() => activePath && openFile(activePath)}
                    className="text-sm text-accent underline"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : htmlPreviewMode && isHtmlPath(activePath) ? (
                <iframe
                  srcDoc={content}
                  title={`Preview ${activePath}`}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  className="flex-1 w-full border-0 bg-white"
                />
              ) : imageBase64 ? (
                <ImageViewer path={activePath} base64={imageBase64} />
              ) : isImagePath(activePath) ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  {canEdit ? (
                    <label className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-2xl px-10 py-12 cursor-pointer active:scale-[0.98] transition text-center">
                      <span className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl leading-none">
                        +
                      </span>
                      <span className="text-sm text-gray-300">
                        {changingImage ? "Menyimpan..." : "Tambah Gambar"}
                      </span>
                      <span className="text-xs text-gray-500 max-w-[220px]">
                        File ini belum punya isi. Pilih gambar buat diisikan ke{" "}
                        <span className="text-gray-400">{activePath}</span>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={changingImage}
                        onChange={(e) => {
                          changeImage(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <p className="text-sm text-gray-500">File gambar ini masih kosong.</p>
                  )}
                </div>
              ) : audioBase64 ? (
                <AudioPlayer path={activePath} src={audioSrc || ""} />
              ) : isAudioPath(activePath) ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  {canEdit ? (
                    <label className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-2xl px-10 py-12 cursor-pointer active:scale-[0.98] transition text-center">
                      <span className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl leading-none">
                        +
                      </span>
                      <span className="text-sm text-gray-300">
                        {changingAudio ? "Menyimpan..." : "Tambah Musik"}
                      </span>
                      <span className="text-xs text-gray-500 max-w-[220px]">
                        File ini belum punya isi. Pilih musik buat diisikan ke{" "}
                        <span className="text-gray-400">{activePath}</span>
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        disabled={changingAudio}
                        onChange={(e) => {
                          changeAudio(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <p className="text-sm text-gray-500">File musik ini masih kosong.</p>
                  )}
                </div>
              ) : videoBase64 ? (
                <VideoPlayer path={activePath} src={videoSrc || ""} />
              ) : isVideoPath(activePath) ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  {canEdit ? (
                    <label className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-2xl px-10 py-12 cursor-pointer active:scale-[0.98] transition text-center">
                      <span className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-2xl leading-none">
                        +
                      </span>
                      <span className="text-sm text-gray-300">
                        {changingVideo ? "Menyimpan..." : "Tambah Video"}
                      </span>
                      <span className="text-xs text-gray-500 max-w-[220px]">
                        File ini belum punya isi. Pilih video buat diisikan ke{" "}
                        <span className="text-gray-400">{activePath}</span>
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        disabled={changingVideo}
                        onChange={(e) => {
                          changeVideo(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <p className="text-sm text-gray-500">File video ini masih kosong.</p>
                  )}
                </div>
              ) : isVideoLinkPath(activePath) && !editMode ? (
                <VideoLinkPlayer path={activePath} url={content} />
              ) : canEdit && editMode && isTouchDevice ? (
                <PlainTextEditor value={content} onChange={setContent} />
              ) : canEdit && editMode ? (
                <CodeEditor
                  path={activePath}
                  value={content}
                  onChange={setContent}
                  aiEnabled={true}
                  readOnly={false}
                />
              ) : (
                <CodeEditor
                  path={activePath}
                  value={content}
                  onChange={canEdit ? setContent : () => {}}
                  aiEnabled={false}
                  readOnly={true}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <p className="text-gray-400 text-sm">
                  Pilih file dari sidebar untuk mulai edit, atau buat file baru.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Commit message dialog */}
      {showCommitBox && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5">
            <h3 className="font-semibold mb-3 text-sm">Pesan Commit</h3>
            <input
              autoFocus
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder={`Update ${activePath}`}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
              onKeyDown={(e) => e.key === "Enter" && saveFile()}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCommitBox(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                onClick={saveFile}
                className="flex-1 py-2.5 rounded-lg bg-accent text-sm font-medium"
              >
                Commit & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {uploadingExtract && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[999] bg-panel border border-border rounded-lg px-4 py-2 text-xs shadow-xl flex items-center gap-2">
          <FaBoxOpen className="text-emerald-400 animate-pulse" size={12} />
          Mengekstrak {uploadingExtract}...
        </div>
      )}
      {showFork && (
        <CopyModal owner={owner} repo={repo} onClose={() => setShowFork(false)} />
      )}
      {actionNode && (
        <FileActionSheet
          node={actionNode}
          onClose={() => setActionNode(null)}
          onDuplicate={duplicateNode}
          onDelete={deleteNode}
          onExtract={extractZipNode}
        />
      )}
      {showFileMenu && activePath && (
        <FileToolbarMenu
          path={activePath}
          onClose={() => setShowFileMenu(false)}
          onEdit={() => setEditMode(true)}
          onRename={renameActiveFile}
          onDelete={deleteActiveFile}
        />
      )}
      {showTest && branch && (
        <TestPanel
          owner={owner}
          repo={repo}
          branch={branch}
          onClose={() => setShowTest(false)}
          onStartTest={(url) => {
            setShowTest(false);
            setTestPreviewUrl(url);
          }}
        />
      )}
      {testPreviewUrl && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col">
          <div className="flex items-center justify-between gap-2 bg-panel border-b border-border px-3 py-2 shrink-0">
            <span className="text-xs text-gray-400 truncate">Testing: {repo}</span>
            <button
              onClick={() => setTestPreviewUrl(null)}
              className="flex items-center gap-1.5 bg-red-900/40 border border-red-800 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
            >
              <FaStop size={10} /> Stop Test
            </button>
          </div>
          <iframe src={testPreviewUrl} className="flex-1 w-full border-0 bg-white" title="Test preview" />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 ${
        active ? "text-accent border-b-2 border-accent" : "text-gray-500"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
