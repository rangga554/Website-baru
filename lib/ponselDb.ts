// ============================================================================
// PROJECT PONSEL — penyimpanan 100% lokal di browser lewat IndexedDB. TIDAK
// ADA data yang dikirim ke server KRYNOS sama sekali (beda total sama
// repo GitHub yang dikelola fitur Editor biasa). Cocok buat ngoding cepat
// langsung dari HP tanpa perlu akun GitHub/koneksi internet buat nyimpen.
//
// Kenapa IndexedDB (bukan localStorage biasa)? localStorage cuma nampung
// ~5-10MB total & string doang (gak bisa nyimpen file upload gambar/PDF
// yang lumayan besar secara efisien). IndexedDB jauh lebih besar
// kapasitasnya (ratusan MB s/d beberapa GB tergantung browser) dan native
// dukung Blob, jadi upload file beneran bisa disimpen apa adanya.
// ============================================================================

const DB_NAME = "mastercode_ponsel_db";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_FILES = "files";

export type PonselProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type PonselFile = {
  id: string; // `${projectId}::${path}`
  projectId: string;
  path: string;
  name: string;
  type: "file" | "folder";
  content?: string; // isi teks (file text)
  blob?: Blob; // isi biner (file upload: gambar, pdf, dll)
  mimeType?: string;
  size?: number;
  isBinary?: boolean;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB gak tersedia di browser ini."));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const store = db.createObjectStore(STORE_FILES, { keyPath: "id" });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store);
}

function fileId(projectId: string, path: string) {
  return `${projectId}::${path}`;
}

// ---------------------------------------------------------------- projects

export async function listProjects(): Promise<PonselProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_PROJECTS, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as PonselProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function createProject(name: string): Promise<PonselProject> {
  const db = await openDb();
  const project: PonselProject = {
    id: crypto.randomUUID(),
    name: name.trim() || "Project Tanpa Nama",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_PROJECTS, "readwrite").add(project);
    req.onsuccess = () => resolve(project);
    req.onerror = () => reject(req.error);
  });
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_PROJECTS, "readwrite");
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const project = getReq.result as PonselProject;
      if (!project) return reject(new Error("Project gak ketemu."));
      project.name = name.trim() || project.name;
      project.updatedAt = Date.now();
      const putReq = store.put(project);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function touchProject(id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_PROJECTS, "readwrite");
  const getReq = store.get(id);
  getReq.onsuccess = () => {
    const project = getReq.result as PonselProject;
    if (project) {
      project.updatedAt = Date.now();
      store.put(project);
    }
  };
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, STORE_PROJECTS, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const files = await listFiles(id);
  const store = tx(db, STORE_FILES, "readwrite");
  await Promise.all(
    files.map(
      (f) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(f.id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
}

// ------------------------------------------------------------------- files

export async function listFiles(projectId: string): Promise<PonselFile[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const index = tx(db, STORE_FILES, "readonly").index("projectId");
    const req = index.getAll(projectId);
    req.onsuccess = () => resolve(req.result as PonselFile[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getFile(projectId: string, path: string): Promise<PonselFile | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_FILES, "readonly").get(fileId(projectId, path));
    req.onsuccess = () => resolve((req.result as PonselFile) || null);
    req.onerror = () => reject(req.error);
  });
}

async function putFile(file: PonselFile): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORE_FILES, "readwrite").put(file);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function createFolder(projectId: string, path: string): Promise<void> {
  const name = path.split("/").pop() || path;
  await putFile({
    id: fileId(projectId, path),
    projectId,
    path,
    name,
    type: "folder",
    updatedAt: Date.now(),
  });
  await touchProject(projectId);
}

export async function saveTextFile(projectId: string, path: string, content: string): Promise<void> {
  const name = path.split("/").pop() || path;
  await putFile({
    id: fileId(projectId, path),
    projectId,
    path,
    name,
    type: "file",
    content,
    isBinary: false,
    size: content.length,
    updatedAt: Date.now(),
  });
  await touchProject(projectId);
}

export async function saveBinaryFile(
  projectId: string,
  path: string,
  blob: Blob,
  mimeType: string
): Promise<void> {
  const name = path.split("/").pop() || path;
  await putFile({
    id: fileId(projectId, path),
    projectId,
    path,
    name,
    type: "file",
    blob,
    mimeType,
    isBinary: true,
    size: blob.size,
    updatedAt: Date.now(),
  });
  await touchProject(projectId);
}

export async function deleteNode(projectId: string, path: string): Promise<void> {
  const all = await listFiles(projectId);
  const db = await openDb();
  const store = tx(db, STORE_FILES, "readwrite");

  // Hapus node itu sendiri + semua yang path-nya diawali "path/" (isi folder).
  const toDelete = all.filter((f) => f.path === path || f.path.startsWith(path + "/"));
  await Promise.all(
    toDelete.map(
      (f) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(f.id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
  await touchProject(projectId);
}

export async function duplicateNode(projectId: string, path: string): Promise<void> {
  const all = await listFiles(projectId);
  const target = all.find((f) => f.path === path);
  if (!target) return;

  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const base = target.name.replace(/(\.[^.]+)?$/, (ext) => ` copy${ext}`);
  const newPath = dir ? `${dir}/${base}` : base;

  if (target.type === "folder") {
    // Duplikat folder + semua isinya secara rekursif.
    const children = all.filter((f) => f.path.startsWith(path + "/"));
    await putFile({ ...target, id: fileId(projectId, newPath), path: newPath, name: base, updatedAt: Date.now() });
    for (const child of children) {
      const rest = child.path.slice(path.length);
      const childNewPath = newPath + rest;
      await putFile({
        ...child,
        id: fileId(projectId, childNewPath),
        path: childNewPath,
        updatedAt: Date.now(),
      });
    }
  } else {
    await putFile({ ...target, id: fileId(projectId, newPath), path: newPath, name: base, updatedAt: Date.now() });
  }
  await touchProject(projectId);
}
