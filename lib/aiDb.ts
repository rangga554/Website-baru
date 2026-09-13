// ============================================================================
// MASTERCODE AI — penyimpanan 100% lokal di browser lewat IndexedDB.
// Percakapan, pesan, DAN project (website) yang dibikin AI semuanya
// disimpen di device ini aja — server KRYNOS cuma dipanggil pas ngobrol
// sama AI (buat dapetin balasan). Gak ada fitur publish ke link publik;
// project cuma bisa di-preview di dalam app dan di-download jadi ZIP.
//
// File project (html/css/js/dst yang dibikin AI) SENGAJA disimpen di sini
// (bukan cuma ditampilin sebagai teks kode di obrolan) — biar "dibawa ke
// latar belakang": user liatnya cuma balasan ngobrol + kartu Project, bukan
// tumpukan kode mentah di chat.
// ============================================================================

const DB_NAME = "mastercode_ai_db";
const DB_VERSION = 1;
const STORE_CONVERSATIONS = "conversations";
const STORE_MESSAGES = "messages";
const STORE_PROJECTS = "projects";
const STORE_FILES = "projectFiles";

export type AiConversation = {
  id: string;
  title: string;
  projectId: string | null; // project AI yang lagi "aktif" di percakapan ini (kalau ada)
  createdAt: number;
  updatedAt: number;
};

export type AiProjectRef = {
  id: string;
  name: string;
  fileCount: number;
  changedPaths: string[]; // path yang baru dibuat/diubah AI di balasan ini
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string; // teks balasan yang ditampilin ke user (TANPA kode mentah)
  projectRef: AiProjectRef | null; // metadata ringan buat nampilin "kartu Project" di bubble ini
  createdAt: number;
};

export type AiProject = {
  id: string;
  conversationId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type AiProjectFile = {
  id: string; // `${projectId}::${path}`
  projectId: string;
  path: string;
  name: string;
  content: string;
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
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const store = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", { unique: false });
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

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function fileId(projectId: string, path: string) {
  return `${projectId}::${path}`;
}

// -------------------------------------------------------------- conversations

export async function listConversations(): Promise<AiConversation[]> {
  const db = await openDb();
  const all = await reqAsPromise(tx(db, STORE_CONVERSATIONS, "readonly").getAll());
  return (all as AiConversation[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(id: string): Promise<AiConversation | null> {
  const db = await openDb();
  const res = await reqAsPromise(tx(db, STORE_CONVERSATIONS, "readonly").get(id));
  return (res as AiConversation) || null;
}

export async function createConversation(title = "Percakapan Baru"): Promise<AiConversation> {
  const db = await openDb();
  const conv: AiConversation = {
    id: crypto.randomUUID(),
    title,
    projectId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await reqAsPromise(tx(db, STORE_CONVERSATIONS, "readwrite").add(conv));
  return conv;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_CONVERSATIONS, "readwrite");
  const conv = (await reqAsPromise(store.get(id))) as AiConversation;
  if (!conv) throw new Error("Percakapan gak ketemu.");
  conv.title = title.trim() || conv.title;
  conv.updatedAt = Date.now();
  await reqAsPromise(store.put(conv));
}

export async function touchConversation(id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_CONVERSATIONS, "readwrite");
  const conv = (await reqAsPromise(store.get(id))) as AiConversation;
  if (conv) {
    conv.updatedAt = Date.now();
    await reqAsPromise(store.put(conv));
  }
}

export async function setConversationProject(id: string, projectId: string | null): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_CONVERSATIONS, "readwrite");
  const conv = (await reqAsPromise(store.get(id))) as AiConversation;
  if (!conv) return;
  conv.projectId = projectId;
  conv.updatedAt = Date.now();
  await reqAsPromise(store.put(conv));
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDb();

  const conv = (await reqAsPromise(tx(db, STORE_CONVERSATIONS, "readonly").get(id))) as AiConversation | undefined;
  await reqAsPromise(tx(db, STORE_CONVERSATIONS, "readwrite").delete(id));

  const msgs = await listMessages(id);
  const msgStore = tx(db, STORE_MESSAGES, "readwrite");
  await Promise.all(msgs.map((m) => reqAsPromise(msgStore.delete(m.id))));

  if (conv?.projectId) {
    await deleteProject(conv.projectId);
  }
}

// ------------------------------------------------------------------ messages

export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  const db = await openDb();
  const index = tx(db, STORE_MESSAGES, "readonly").index("conversationId");
  const all = await reqAsPromise(index.getAll(conversationId));
  return (all as AiMessage[]).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  projectRef: AiProjectRef | null = null
): Promise<AiMessage> {
  const db = await openDb();
  const msg: AiMessage = {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    projectRef,
    createdAt: Date.now(),
  };
  await reqAsPromise(tx(db, STORE_MESSAGES, "readwrite").add(msg));
  await touchConversation(conversationId);
  return msg;
}

// ------------------------------------------------------------------ projects

export async function listAllProjects(): Promise<AiProject[]> {
  const db = await openDb();
  const all = await reqAsPromise(tx(db, STORE_PROJECTS, "readonly").getAll());
  return (all as AiProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<AiProject | null> {
  const db = await openDb();
  const res = await reqAsPromise(tx(db, STORE_PROJECTS, "readonly").get(id));
  return (res as AiProject) || null;
}

export async function createProject(conversationId: string, name: string): Promise<AiProject> {
  const db = await openDb();
  const project: AiProject = {
    id: crypto.randomUUID(),
    conversationId,
    name: name.trim() || "Project AI Tanpa Nama",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await reqAsPromise(tx(db, STORE_PROJECTS, "readwrite").add(project));
  await setConversationProject(conversationId, project.id);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_PROJECTS, "readwrite");
  const project = (await reqAsPromise(store.get(id))) as AiProject;
  if (!project) throw new Error("Project gak ketemu.");
  project.name = name.trim() || project.name;
  project.updatedAt = Date.now();
  await reqAsPromise(store.put(project));
}

export async function touchProject(id: string): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_PROJECTS, "readwrite");
  const project = (await reqAsPromise(store.get(id))) as AiProject;
  if (project) {
    project.updatedAt = Date.now();
    await reqAsPromise(store.put(project));
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  await reqAsPromise(tx(db, STORE_PROJECTS, "readwrite").delete(id));

  const files = await listProjectFiles(id);
  const store = tx(db, STORE_FILES, "readwrite");
  await Promise.all(files.map((f) => reqAsPromise(store.delete(f.id))));
}

// ------------------------------------------------------------------ files

export async function listProjectFiles(projectId: string): Promise<AiProjectFile[]> {
  const db = await openDb();
  const index = tx(db, STORE_FILES, "readonly").index("projectId");
  const all = await reqAsPromise(index.getAll(projectId));
  return (all as AiProjectFile[]).sort((a, b) => a.path.localeCompare(b.path));
}

// Nulis/nimpa banyak file sekaligus (dipanggil abis AI ngebalikin project
// baru/hasil edit) — file yang gak disebut AI di respons itu TETAP UTUH,
// cuma yang path-nya disebut yang ke-update.
export async function upsertProjectFiles(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<void> {
  const db = await openDb();
  const store = tx(db, STORE_FILES, "readwrite");
  const now = Date.now();
  await Promise.all(
    files.map((f) => {
      const path = f.path.replace(/^\/+/, "");
      const name = path.split("/").pop() || path;
      const record: AiProjectFile = {
        id: fileId(projectId, path),
        projectId,
        path,
        name,
        content: f.content,
        updatedAt: now,
      };
      return reqAsPromise(store.put(record));
    })
  );
  await touchProject(projectId);
}

export async function saveProjectFile(projectId: string, path: string, content: string): Promise<void> {
  await upsertProjectFiles(projectId, [{ path, content }]);
}

export async function deleteProjectFile(projectId: string, path: string): Promise<void> {
  const db = await openDb();
  await reqAsPromise(tx(db, STORE_FILES, "readwrite").delete(fileId(projectId, path)));
  await touchProject(projectId);
}
