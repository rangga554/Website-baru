"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaBars,
  FaTimes,
  FaFileMedical,
  FaFolderPlus,
  FaUpload,
  FaDownload,
  FaFileImage,
} from "react-icons/fa";
import { FileNode } from "@/types";
import { downloadBlob } from "@/lib/nativeDownload";
import FileTree from "@/components/FileTree";
import FileActionSheet from "@/components/FileActionSheet";
import PlainTextEditor from "@/components/PlainTextEditor";
import {
  PonselProject,
  PonselFile,
  listProjects,
  listFiles,
  getFile,
  saveTextFile,
  saveBinaryFile,
  createFolder,
  deleteNode,
  duplicateNode,
} from "@/lib/ponselDb";

const TEXT_EXT = [
  "js", "jsx", "ts", "tsx", "json", "html", "css", "scss", "md", "txt", "lua",
  "py", "java", "c", "cpp", "h", "yml", "yaml", "xml", "env", "gitignore",
  "sh", "sql", "csv", "svg",
];

function isTextFile(name: string, mimeType?: string) {
  if (mimeType?.startsWith("text/")) return true;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXT.includes(ext);
}

function isImageFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"].includes(ext);
}

// Sama logikanya kayak buildFileTree di types/index.ts (buat repo GitHub),
// tapi versi lokal: folder implisit muncul otomatis dari path file, gak
// perlu explicit dibuat kecuali user pencet "Folder Baru" buat folder kosong.
function buildLocalTree(files: PonselFile[]): FileNode[] {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  const sorted = [...files].sort((a, b) => a.path.split("/").length - b.path.split("/").length);

  for (const f of sorted) {
    const parts = f.path.split("/");
    let currentPath = "";
    let currentLevel = root;

    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = idx === parts.length - 1;

      let node = map[currentPath];
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLeaf ? f.type : "folder",
          children: isLeaf && f.type === "file" ? undefined : [],
        };
        map[currentPath] = node;
        currentLevel.push(node);
      }
      if (node.type === "folder") currentLevel = node.children!;
    });
  }

  const sortRec = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortRec(n.children));
  };
  sortRec(root);

  return root;
}

export default function ProjectPonselEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<PonselProject | null>(null);
  const [files, setFiles] = useState<PonselFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<PonselFile | null>(null);
  const [textValue, setTextValue] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actionNode, setActionNode] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const uploadRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = useMemo(() => buildLocalTree(files), [files]);

  const load = useCallback(async () => {
    const projects = await listProjects();
    const p = projects.find((x) => x.id === projectId) || null;
    setProject(p);
    setFiles(await listFiles(projectId));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectFile(path: string) {
    setActivePath(path);
    setPreviewUrl(null);
    const f = await getFile(projectId, path);
    setActiveFile(f);
    if (f && !f.isBinary) {
      setTextValue(f.content || "");
    } else if (f?.blob) {
      setPreviewUrl(URL.createObjectURL(f.blob));
    }
    setSidebarOpen(false);
  }

  function onTextChange(val: string) {
    setTextValue(val);
    if (!activePath) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveTextFile(projectId, activePath, val);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1200);
    }, 500);
  }

  function currentDir(): string {
    if (!activePath) return "";
    if (!activeFile || activeFile.type === "file") {
      return activePath.includes("/") ? activePath.slice(0, activePath.lastIndexOf("/")) : "";
    }
    return activePath;
  }

  async function onNewFile() {
    const dir = currentDir();
    const name = prompt("Nama file baru (boleh pakai folder/, contoh: src/index.js):");
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    await saveTextFile(projectId, path, "");
    await load();
    selectFile(path);
  }

  async function onNewFolder() {
    const dir = currentDir();
    const name = prompt("Nama folder baru:");
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    await createFolder(projectId, path);
    await load();
  }

  async function onUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const dir = currentDir();
    for (const file of Array.from(fileList)) {
      const path = dir ? `${dir}/${file.name}` : file.name;
      if (isTextFile(file.name, file.type)) {
        const content = await file.text();
        await saveTextFile(projectId, path, content);
      } else {
        await saveBinaryFile(projectId, path, file, file.type || "application/octet-stream");
      }
    }
    await load();
    if (uploadRef.current) uploadRef.current.value = "";
  }

  async function onDeleteNode(node: FileNode) {
    if (!confirm(`Hapus "${node.name}"?`)) return;
    await deleteNode(projectId, node.path);
    setActionNode(null);
    if (activePath === node.path || activePath?.startsWith(node.path + "/")) {
      setActivePath(null);
      setActiveFile(null);
    }
    await load();
  }

  async function onDuplicateNode(node: FileNode) {
    await duplicateNode(projectId, node.path);
    setActionNode(null);
    await load();
  }

  async function downloadZip() {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const f of files) {
      if (f.type === "folder") {
        zip.folder(f.path);
      } else if (f.isBinary && f.blob) {
        zip.file(f.path, f.blob);
      } else {
        zip.file(f.path, f.content || "");
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    await downloadBlob(blob, `${project?.name || "project-ponsel"}.zip`);
  }

  async function downloadActiveFile() {
    if (!activeFile) return;
    if (activeFile.isBinary && activeFile.blob) {
      await downloadBlob(activeFile.blob, activeFile.name);
    } else if (previewUrl) {
      // previewUrl di sini udah blob: URL (dibikin lewat createObjectURL di
      // useEffect lain), jadi tinggal fetch balik jadi Blob biar bisa lewat
      // jalur yang sama dengan downloadBlob (aman dipakai di app native).
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      await downloadBlob(blob, activeFile.name);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 text-center py-10 bg-base min-h-dvh">Memuat project...</p>;
  }

  if (!project) {
    return (
      <main className="min-h-dvh bg-base flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-gray-500">Project gak ketemu (mungkin udah dihapus).</p>
        <Link href="/project-ponsel" className="text-accent text-sm underline">
          Balik ke daftar project
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-base flex flex-col">
      <header className="sticky top-0 z-20 bg-base/95 backdrop-blur border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-400 md:hidden">
          <FaBars size={16} />
        </button>
        <Link href="/project-ponsel" className="p-1.5 text-gray-400 hidden md:block">
          <FaArrowLeft size={16} />
        </Link>
        <h1 className="font-semibold text-sm truncate flex-1">{project.name}</h1>
        {saveState !== "idle" && (
          <span className="text-[10px] text-gray-500">{saveState === "saving" ? "Menyimpan..." : "Tersimpan"}</span>
        )}
        <button onClick={downloadZip} className="p-2 text-gray-400 hover:text-accent" title="Download ZIP">
          <FaDownload size={14} />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar file tree */}
        <div
          className={`fixed md:static inset-y-0 left-0 z-30 w-72 max-w-[82vw] md:w-64 bg-panel border-r border-border
          flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border md:hidden">
            <span className="text-xs font-semibold text-gray-400">File</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 text-gray-400">
              <FaTimes size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
            <button
              onClick={onNewFile}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md hover:bg-white/5 text-gray-300"
              title="File baru"
            >
              <FaFileMedical size={11} /> File
            </button>
            <button
              onClick={onNewFolder}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md hover:bg-white/5 text-gray-300"
              title="Folder baru"
            >
              <FaFolderPlus size={11} /> Folder
            </button>
            <button
              onClick={() => uploadRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md hover:bg-white/5 text-gray-300"
              title="Upload file"
            >
              <FaUpload size={11} /> Upload
            </button>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {tree.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6 px-2">
                Belum ada file. Bikin file baru atau upload dari HP kamu.
              </p>
            ) : (
              <FileTree
                nodes={tree}
                activePath={activePath || undefined}
                onSelectFile={selectFile}
                onAction={setActionNode}
              />
            )}
          </div>
        </div>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Editor / preview area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!activePath ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 px-4 text-center">
              Pilih file di sidebar, atau bikin file/folder baru buat mulai.
            </div>
          ) : activeFile?.isBinary ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              {previewUrl && isImageFile(activeFile.name) ? (
                <img src={previewUrl} alt={activeFile.name} className="max-w-full max-h-[60vh] rounded-lg border border-border" />
              ) : (
                <FaFileImage size={32} className="text-gray-600" />
              )}
              <p className="text-sm">{activeFile.name}</p>
              <p className="text-xs text-gray-500">
                {activeFile.mimeType} · {((activeFile.size || 0) / 1024).toFixed(1)} KB
              </p>
              {previewUrl && (
                <button onClick={downloadActiveFile} className="text-xs text-accent underline">
                  Download file ini
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <PlainTextEditor value={textValue} onChange={onTextChange} />
            </div>
          )}
        </div>
      </div>

      {actionNode && (
        <FileActionSheet
          node={actionNode}
          onClose={() => setActionNode(null)}
          onDuplicate={onDuplicateNode}
          onDelete={onDeleteNode}
        />
      )}
    </main>
  );
}
