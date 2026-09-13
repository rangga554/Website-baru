// ============================================================================
// ENGINE FORMAT BINARY .rbxl (Roblox Place File) — dipakai fitur "Roblox"
// di Aplikasi Pihak Ketiga.
//
// PENTING SOAL RISIKO: format ini TIDAK RESMI didokumentasikan Roblox
// (dibedah komunitas). Prinsip yang dipegang di sini:
//   1. BACA (explorer, lihat source script) — 100% aman, kalau gagal parse
//      ya cuma error ditampilkan, file asli user TIDAK PERNAH kesentuh.
//   2. EDIT SOURCE SCRIPT YANG SUDAH ADA — cuma ganti isi 1 value String di
//      1 chunk PROP, semua byte lain di file dibiarin PERSIS sama. Paling
//      aman dari semua operasi tulis.
//   3. BUAT / HAPUS SCRIPT (nambah/ngurangin instance) — paling berisiko,
//      karena beberapa tipe data disimpan dalam bentuk "array ter-transpose"
//      yang manipulasinya rawan. Makanya SETIAP hasil tulis di-parse ULANG
//      sendiri sebelum diupload buat mastiin strukturnya konsisten — kalau
//      ada tipe properti yang gak dikenali/gak yakin, operasi DIBATALKAN
//      dengan pesan jelas, DAN GAK PERNAH nebak/nulis data ngasal.
// ============================================================================

import { decompress as zstdDecompress } from "fzstd";

// Roblox ternyata pakai kompresi Zstandard (zstd) buat tiap chunk-nya —
// kebukti dari magic number "28 b5 2f fd" di awal setiap chunk compressed
// (bukan LZ4 kayak dugaan awal, makanya semua percobaan decoder LZ4
// sebelumnya gagal total). Dipakai library `fzstd` (pure JS, khusus
// decompress, gak butuh native binding) daripada nulis decoder zstd
// sendiri — zstd jauh lebih kompleks dari LZ4 (ada entropy coding
// Huffman/FSE), terlalu berisiko ditulis tangan.
function decompressZstdBlock(src: Buffer, dstLen: number): Buffer {
  const out = zstdDecompress(new Uint8Array(src), new Uint8Array(dstLen));
  return Buffer.from(out);
}

const MAGIC = Buffer.from("<roblox!\x89\xff\x0d\x0a\x1a\x0a", "binary");
const HEADER_LEN = 32;

type ChunkRaw = { name: string; data: Buffer; compLen?: number; uncompLen?: number; rawOriginal?: Buffer; modified?: boolean };

function readHeader(buf: Buffer) {
  if (buf.length < HEADER_LEN || !buf.subarray(0, 14).equals(MAGIC)) {
    throw new Error("Bukan file .rbxl binary yang valid (magic header tidak cocok — mungkin format XML/.rbxlx atau file corrupt).");
  }
  return {
    version: buf.readUInt16LE(14),
    numClasses: buf.readInt32LE(16),
    numInstances: buf.readInt32LE(20),
  };
}

function readChunks(buf: Buffer): ChunkRaw[] {
  const chunks: ChunkRaw[] = [];
  let off = HEADER_LEN;
  while (off < buf.length) {
    const name = buf.subarray(off, off + 4).toString("binary").replace(/\0+$/, "");
    // Urutan ASLI (compLen dulu baru uncompLen) itu BENER — kebukti dari
    // seluruh 1843 chunk file kebaca konsisten pake urutan ini. compLen
    // kadang SEDIKIT lebih gede dari uncompLen itu WAJAR di LZ4 (ada batas
    // toleransi worst-case expansion buat data yang gak banyak pola
    // berulang) — bukan tanda field ketuker. Sempet ke-swap tapi ternyata
    // salah duga, dibalikin lagi ke sini.
    const compLen = buf.readUInt32LE(off + 4);
    const uncompLen = buf.readUInt32LE(off + 8);
    off += 16; // 4 name + 4 compLen + 4 uncompLen + 4 reserved
    const raw = buf.subarray(off, off + (compLen > 0 ? compLen : uncompLen));
    off += compLen > 0 ? compLen : uncompLen;
    let data: Buffer;
    if (compLen > 0) {
      data = decompressZstdBlock(raw, uncompLen);
    } else {
      data = Buffer.from(raw);
    }
    chunks.push({ name, data, compLen, uncompLen, rawOriginal: Buffer.from(raw) });
    if (name === "END") break;
  }
  return chunks;
}

// Chunk yang TIDAK diubah ditulis ulang byte-persis-sama kayak file asli
// (compLen/uncompLen/payload original dipakai verbatim, gak lewat decompress
// -> recompress lagi). Chunk yang MEMANG diubah disimpan APA ADANYA tanpa
// kompresi (compLen=0) — ini valid di spesifikasi format-nya, jadi gak
// perlu nulis encoder LZ4 sendiri sama sekali (satu sumber risiko ilang).
function writeChunks(header: { version: number; numClasses: number; numInstances: number }, chunks: ChunkRaw[]): Buffer {
  const parts: Buffer[] = [];
  const head = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(head, 0);
  head.writeUInt16LE(header.version, 14);
  head.writeInt32LE(header.numClasses, 16);
  head.writeInt32LE(header.numInstances, 20);
  parts.push(head);

  for (const c of chunks) {
    let compLen: number;
    let uncompLen: number;
    let payload: Buffer;
    if (c.modified || !c.rawOriginal) {
      compLen = 0;
      uncompLen = c.data.length;
      payload = c.data;
    } else {
      compLen = c.compLen ?? 0;
      uncompLen = c.uncompLen ?? c.data.length;
      payload = c.rawOriginal;
    }
    const ch = Buffer.alloc(16);
    Buffer.from(c.name.padEnd(4, "\0").slice(0, 4), "binary").copy(ch, 0);
    ch.writeUInt32LE(compLen, 4);
    ch.writeUInt32LE(uncompLen, 8);
    ch.writeUInt32LE(0, 12);
    parts.push(ch, payload);
  }
  return Buffer.concat(parts);
}

// ----------------------------------------------------------------------------
// Baca string ber-prefix int32 (dipakai di banyak tempat: nama kelas, nama
// properti, dan tiap value tipe String).
// ----------------------------------------------------------------------------
function readPString(buf: Buffer, off: number): { value: string; next: number } {
  const len = buf.readInt32LE(off);
  const value = buf.subarray(off + 4, off + 4 + len).toString("utf-8");
  return { value, next: off + 4 + len };
}
function writePString(s: string): Buffer {
  const b = Buffer.from(s, "utf-8");
  const out = Buffer.alloc(4 + b.length);
  out.writeInt32LE(b.length, 0);
  b.copy(out, 4);
  return out;
}

// ----------------------------------------------------------------------------
// Array int32 ter-interleave (byte column transpose) — dipakai buat
// referent (INST/PRNT/PROP tipe Ref) DAN properti Int32/Enum biasa.
// hasDeltaZigZag: true khusus buat referent & tipe Int32 (nilai disimpan
// selisih dari sebelumnya + zigzag), Enum biasanya RAW interleave doang.
// ----------------------------------------------------------------------------
function detranspose4(buf: Buffer, off: number, count: number): Int32Array {
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] =
      (buf[off + i] << 24) |
      (buf[off + count + i] << 16) |
      (buf[off + count * 2 + i] << 8) |
      buf[off + count * 3 + i];
  }
  return out;
}
function retranspose4(values: number[] | Int32Array): Buffer {
  const count = values.length;
  const out = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++) {
    const v = values[i] | 0;
    out[i] = (v >>> 24) & 0xff;
    out[count + i] = (v >>> 16) & 0xff;
    out[count * 2 + i] = (v >>> 8) & 0xff;
    out[count * 3 + i] = v & 0xff;
  }
  return out;
}
function zigzagDecode(v: number): number {
  return (v >>> 1) ^ -(v & 1);
}
function zigzagEncode(v: number): number {
  return (v << 1) ^ (v >> 31);
}
function decodeInt32Array(buf: Buffer, off: number, count: number, delta: boolean): number[] {
  const raw = detranspose4(buf, off, count);
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    if (delta) {
      acc += zigzagDecode(raw[i]);
      out.push(acc);
    } else {
      out.push(raw[i]);
    }
  }
  return out;
}
function encodeInt32Array(values: number[], delta: boolean): Buffer {
  if (!delta) return retranspose4(values);
  const raw: number[] = [];
  let prev = 0;
  for (const v of values) {
    raw.push(zigzagEncode(v - prev));
    prev = v;
  }
  return retranspose4(raw);
}

// ----------------------------------------------------------------------------
// Versi GENERIK buat lebar berapa aja (1/4/8/dst byte) — kerja di level byte
// mentah, TANPA interpretasi angka sama sekali. Dipakai buat tipe yang gak
// butuh delta encoding (Bool lebar 1, Float32/Enum/SecurityCapabilities/
// Int64 dkk lebar 4 atau 8) sewaktu insert/hapus instance — kita cuma perlu
// "pindahin baris" dengan benar, gak perlu ngerti artinya.
// ----------------------------------------------------------------------------
function detransposeBytes(buf: Buffer, off: number, count: number, width: number): Buffer[] {
  const rows: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const row = Buffer.alloc(width);
    for (let b = 0; b < width; b++) row[b] = buf[off + b * count + i];
    rows.push(row);
  }
  return rows;
}
function retransposeBytes(rows: Buffer[]): Buffer {
  const count = rows.length;
  const width = rows.length > 0 ? rows[0].length : 0;
  const out = Buffer.alloc(count * width);
  for (let i = 0; i < count; i++) {
    for (let b = 0; b < width; b++) out[b * count + i] = rows[i][b];
  }
  return out;
}

// ============================================================================
// TABEL LEBAR TIPE PROPERTI YANG DIDUKUNG buat operasi INSERT/REMOVE instance
// (dipakai fitur "Buat Script" & "Hapus Script"). Tipe di luar daftar ini
// otomatis bikin operasi DIBATALKAN (bukan ditebak) — lihat komentar header.
// width null = tipe String (variable length, prefix int32).
// ============================================================================
const KNOWN_TYPES: Record<number, { width: number | null; delta: boolean }> = {
  0x01: { width: null, delta: false }, // String / ProtectedString / Content path
  0x02: { width: 1, delta: false }, // Bool
  0x03: { width: 4, delta: true }, // Int32
  0x04: { width: 4, delta: false }, // Float32 (raw interleave, tanpa delta)
  0x05: { width: 8, delta: false }, // Float64/Double (raw interleave, tanpa delta)
  0x12: { width: 4, delta: false }, // Enum / Token
  0x13: { width: 4, delta: true }, // Ref (referent ke instance lain)
  0x1b: { width: 8, delta: false }, // Int64 (misal Script.SourceAssetId)
  0x1f: { width: 16, delta: false }, // UniqueId (misal Script.HistoryId) — struct index+time+random, 16 byte
  0x21: { width: 8, delta: false }, // SecurityCapabilities (Script.Capabilities)
};

type PropChunk = {
  classIndex: number;
  className: string;
  propName: string;
  dataType: number;
  headerBeforeValues: Buffer; // classIndex(4)+propName(pstring)+dataType(1)
  valuesRaw: Buffer; // payload sisanya (belum di-decode, kecuali String yg perlu discan)
  count: number;
};

function parsePropChunk(data: Buffer, classIndex: number, classInstCount: Record<number, number>): PropChunk {
  const ci = data.readInt32LE(0);
  const { value: propName, next } = readPString(data, 4);
  const dataType = data[next];
  const valuesRaw = data.subarray(next + 1);
  return {
    classIndex: ci,
    className: "",
    propName,
    dataType,
    headerBeforeValues: data.subarray(0, next + 1),
    valuesRaw,
    count: classInstCount[ci] || 0,
  };
}

// Pecah array String type PROP jadi list Buffer per-instance (masing-masing
// termasuk 4-byte length prefixnya) — String TIDAK di-transpose, jadi ini
// sekedar scan sequential.
function splitStringValues(raw: Buffer, count: number): Buffer[] {
  const out: Buffer[] = [];
  let off = 0;
  for (let i = 0; i < count; i++) {
    const len = raw.readInt32LE(off);
    out.push(raw.subarray(off, off + 4 + len));
    off += 4 + len;
  }
  return out;
}

export type ScriptNode = {
  referent: number;
  className: "Script" | "LocalScript" | "ModuleScript";
  name: string;
};
export type TreeNode = {
  referent: number;
  className: string;
  name: string;
  children: TreeNode[];
  isScript?: boolean;
};

const SCRIPT_CLASSES = new Set(["Script", "LocalScript", "ModuleScript"]);
// Fokus cuma 3 ini sesuai request — jangan diperluas lagi tanpa diminta.
const TARGET_SERVICES = new Set(["ServerScriptService", "StarterPlayerScripts", "StarterCharacterScripts"]);

// ----------------------------------------------------------------------------
// Parse penuh: dari buffer .rbxl -> struktur yang dibutuhin buat nampilin
// tree Universe/Service/Script + baca isi Source.
// ----------------------------------------------------------------------------
export function parsePlaceFile(buf: Buffer) {
  const header = readHeader(buf);
  const chunks = readChunks(buf);

  // classIndex -> { className, referents[], isService }
  const classes: Record<number, { className: string; referents: number[]; isService: boolean }> = {};
  const propChunksByClass: Record<number, PropChunk[]> = {};
  let parentPairs: { child: number; parent: number }[] = [];

  for (const c of chunks) {
    if (c.name === "INST") {
      const classIndex = c.data.readInt32LE(0);
      const { value: className, next } = readPString(c.data, 4);
      const isService = c.data[next] !== 0;
      const numInst = c.data.readInt32LE(next + 1);
      const referents = decodeInt32Array(c.data, next + 5, numInst, true);
      classes[classIndex] = { className, referents, isService };
    }
  }
  for (const c of chunks) {
    if (c.name === "PROP") {
      const classIndex = c.data.readInt32LE(0);
      const cls = classes[classIndex];
      const count = cls ? cls.referents.length : 0;
      const p = parsePropChunk(c.data, classIndex, { [classIndex]: count });
      p.className = cls?.className || "?";
      (propChunksByClass[classIndex] ||= []).push(p);
    }
    if (c.name === "PRNT") {
      const version = c.data[0]; // biasanya 0
      const count = c.data.readInt32LE(1);
      const children = decodeInt32Array(c.data, 5, count, true);
      const parents = decodeInt32Array(c.data, 5 + count * 4, count, true);
      parentPairs = children.map((ch, i) => ({ child: ch, parent: parents[i] }));
    }
  }

  // referent -> Name (dari PROP "Name" per kelas)
  const nameByReferent: Record<number, string> = {};
  for (const classIndex of Object.keys(classes).map(Number)) {
    const cls = classes[classIndex];
    const nameProp = (propChunksByClass[classIndex] || []).find((p) => p.propName === "Name");
    if (nameProp && nameProp.dataType === 0x01) {
      const vals = splitStringValues(nameProp.valuesRaw, cls.referents.length);
      cls.referents.forEach((ref, i) => {
        nameByReferent[ref] = readPString(vals[i], 0).value;
      });
    }
  }

  // referent -> className
  const classByReferent: Record<number, string> = {};
  const referentToClassIndex: Record<number, number> = {};
  for (const classIndex of Object.keys(classes).map(Number)) {
    for (const ref of classes[classIndex].referents) {
      classByReferent[ref] = classes[classIndex].className;
      referentToClassIndex[ref] = classIndex;
    }
  }

  // Bangun tree parent -> children
  const childrenOf: Record<number, number[]> = {};
  for (const { child, parent } of parentPairs) {
    (childrenOf[parent] ||= []).push(child);
  }
  const rootReferent = -1; // Roblox pakai -1 sebagai "root DataModel" di PRNT

  function buildNode(ref: number): TreeNode {
    const cn = classByReferent[ref] || "?";
    return {
      referent: ref,
      className: cn,
      name: nameByReferent[ref] || cn,
      isScript: SCRIPT_CLASSES.has(cn),
      children: (childrenOf[ref] || []).map(buildNode),
    };
  }

  const topLevel = (childrenOf[rootReferent] || []).map(buildNode);

  // PENTING: StarterPlayerScripts & StarterCharacterScripts BUKAN service
  // level-atas — keduanya nempel di DALAM service "StarterPlayer"
  // (StarterPlayer.StarterPlayerScripts / StarterPlayer.StarterCharacterScripts).
  // ServerScriptService sendiri emang service level-atas. Makanya di sini
  // kita cari sampai 2 level ke bawah, bukan cuma top-level doang.
  const services: TreeNode[] = [];
  function collectTargets(node: TreeNode, depth: number) {
    if (TARGET_SERVICES.has(node.name) || TARGET_SERVICES.has(node.className)) {
      services.push(node);
      return; // udah ketemu, gak usah masuk lebih dalam dari node ini
    }
    if (depth >= 2) return;
    for (const child of node.children) collectTargets(child, depth + 1);
  }
  for (const top of topLevel) collectTargets(top, 0);

  return {
    header,
    chunks,
    classes,
    propChunksByClass,
    nameByReferent,
    classByReferent,
    referentToClassIndex,
    childrenOf,
    services,
    topLevel,
  };
}

// ----------------------------------------------------------------------------
// DIAGNOSTIK — baca chunk-level doang (gak build tree), tiap tahap dibungkus
// try/catch sendiri-sendiri, biar kalau ada yang gagal, bagian LAIN tetap
// kelihatan hasilnya. Dipakai buat nyari tau persis nyangkutnya di mana
// kalau parsePlaceFile normal gagal / hasilnya kosong.
// ----------------------------------------------------------------------------
export function inspectPlaceFile(buf: Buffer) {
  const result: any = {
    fileSizeBytes: buf.length,
    magicOk: false,
    header: null,
    chunks: [],
    classes: [],
    prnt: null,
    errors: [] as string[],
    // Preview mentah 64 byte pertama — biar kelihatan PERSIS apa yang
    // dikirim Roblox (XML .rbxlx? JSON error? beda versi binary?) kalau
    // magic header binary-nya gak cocok.
    first64BytesAscii: buf.subarray(0, 64).toString("latin1").replace(/[^\x20-\x7e]/g, "."),
    first32BytesHex: buf.subarray(0, 32).toString("hex"),
  };

  try {
    result.header = readHeader(buf);
    result.magicOk = true;
  } catch (e: any) {
    result.errors.push(`header: ${e?.message}`);
    return result; // gak bisa lanjut sama sekali kalau header aja gagal
  }

  let chunks: ChunkRaw[] = [];
  try {
    chunks = readChunks(buf);
    result.totalChunks = chunks.length;
    result.chunks = chunks.slice(0, 12).map((c) => ({
      name: c.name,
      compLen: c.compLen,
      uncompLen: c.uncompLen,
      decodedSize: c.data.length,
      first40Hex: c.data.subarray(0, 40).toString("hex"),
      // Byte mentah SEBELUM decompress — buat ngecek apa ini beneran raw
      // LZ4 block atau ternyata format lain (misal LZ4 Frame yang punya
      // magic number sendiri 04 22 4D 18 di awal).
      rawCompressedFirst24Hex: c.rawOriginal ? c.rawOriginal.subarray(0, 24).toString("hex") : null,
    }));
  } catch (e: any) {
    result.errors.push(`readChunks: ${e?.message}`);
    return result;
  }

  for (const c of chunks) {
    if (c.name !== "INST") continue;
    if (result.classes.length >= 12) break;
    try {
      const classIndex = c.data.readInt32LE(0);
      const { value: className, next } = readPString(c.data, 4);
      const isService = c.data[next] !== 0;
      const numInst = c.data.readInt32LE(next + 1);
      let referentsSample: number[] = [];
      try {
        referentsSample = decodeInt32Array(c.data, next + 5, Math.min(numInst, 3), true);
      } catch (e: any) {
        result.errors.push(`INST[${className}] decode referents: ${e?.message}`);
      }
      result.classes.push({ classIndex, className, isService, numInst, referentsSample });
    } catch (e: any) {
      result.errors.push(`INST chunk: ${e?.message}`);
    }
  }

  const prntChunk = chunks.find((c) => c.name === "PRNT");
  if (prntChunk) {
    try {
      const version = prntChunk.data[0];
      const count = prntChunk.data.readInt32LE(1);
      const childrenSample = decodeInt32Array(prntChunk.data, 5, Math.min(count, 5), true);
      const parentsSample = decodeInt32Array(prntChunk.data, 5 + count * 4, Math.min(count, 5), true);
      result.prnt = { version, count, childrenSample, parentsSample };
    } catch (e: any) {
      result.errors.push(`PRNT chunk: ${e?.message}`);
    }
  } else {
    result.errors.push("Tidak ada chunk PRNT sama sekali di file ini.");
  }

  return result;
}


export function getScriptSource(buf: Buffer, referent: number): string {
  const p = parsePlaceFile(buf);
  const classIndex = p.referentToClassIndex[referent];
  if (classIndex === undefined) throw new Error("Instance tidak ditemukan di file place ini.");
  const cls = p.classes[classIndex];
  if (!SCRIPT_CLASSES.has(cls.className)) throw new Error("Instance ini bukan Script/LocalScript/ModuleScript.");

  const srcProp = (p.propChunksByClass[classIndex] || []).find((pc) => pc.propName === "Source");
  if (!srcProp || srcProp.dataType !== 0x01) throw new Error("Properti Source tidak ditemukan (kemungkinan versi format berbeda).");

  const idx = cls.referents.indexOf(referent);
  const vals = splitStringValues(srcProp.valuesRaw, cls.referents.length);
  return readPString(vals[idx], 0).value;
}

// ----------------------------------------------------------------------------
// PATCH source 1 script yang SUDAH ADA — operasi tulis paling aman: cuma
// ganti isi 1 value String, semua chunk lain di-copy identik.
// ----------------------------------------------------------------------------
export function patchScriptSource(buf: Buffer, referent: number, newSource: string): Buffer {
  const p = parsePlaceFile(buf);
  const classIndex = p.referentToClassIndex[referent];
  if (classIndex === undefined) throw new Error("Instance tidak ditemukan.");
  const cls = p.classes[classIndex];
  if (!SCRIPT_CLASSES.has(cls.className)) throw new Error("Instance ini bukan Script/LocalScript/ModuleScript.");

  const idx = cls.referents.indexOf(referent);
  const newChunks: ChunkRaw[] = p.chunks.map((c) => ({ ...c }));

  let patched = false;
  for (let i = 0; i < newChunks.length; i++) {
    const c = newChunks[i];
    if (c.name !== "PROP") continue;
    const ci = c.data.readInt32LE(0);
    if (ci !== classIndex) continue;
    const { value: propName, next } = readPString(c.data, 4);
    if (propName !== "Source") continue;
    const dataType = c.data[next];
    if (dataType !== 0x01) throw new Error("Tipe properti Source tidak dikenali, dibatalkan demi keamanan.");
    const valuesRaw = c.data.subarray(next + 1);
    const vals = splitStringValues(valuesRaw, cls.referents.length);
    vals[idx] = writePString(newSource);
    const newValuesRaw = Buffer.concat(vals);
    newChunks[i] = { name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), newValuesRaw]), modified: true };
    patched = true;
    break;
  }
  if (!patched) throw new Error("Gagal menemukan chunk Source untuk instance ini.");

  const out = writeChunks(p.header, newChunks);
  // Self-check: parse ulang hasil tulisan sendiri, mastiin source-nya kebaca balik SAMA.
  const verify = getScriptSource(out, referent);
  if (verify !== newSource) throw new Error("Verifikasi gagal setelah menulis — perubahan DIBATALKAN, file asli tidak terpengaruh.");
  return out;
}

// ----------------------------------------------------------------------------
// BUAT script baru di bawah 1 parent (service/folder) yang sudah ada.
// Strategi aman: cari instance kelas yang SAMA di file ini buat dijadiin
// "template" nilai default semua properti lain (kita cuma override Name &
// Source) — jadi kita gak perlu ngerti arti tiap properti, tinggal DUPLIKAT
// slot-nya di array. Kalau kelasnya belum ada SAMA SEKALI di file / ada
// tipe properti yang gak dikenal (di luar KNOWN_TYPES), operasi DIBATALKAN.
// ----------------------------------------------------------------------------
export function createScript(
  buf: Buffer,
  parentReferent: number,
  className: "Script" | "LocalScript" | "ModuleScript",
  name: string,
  source: string
): Buffer {
  const p = parsePlaceFile(buf);
  if (p.classByReferent[parentReferent] === undefined) throw new Error("Parent (service/folder) tidak ditemukan.");

  const classIndex = Object.keys(p.classes)
    .map(Number)
    .find((ci) => p.classes[ci].className === className);
  if (classIndex === undefined) {
    throw new Error(
      `Belum ada instance ${className} sama sekali di place ini, jadi KRYNOS belum bisa bikin yang baru dengan aman (butuh template properti). Buat manual dulu satu lewat Studio, setelah itu bisa dibuat lewat sini.`
    );
  }
  const cls = p.classes[classIndex];
  const templateIdx = 0; // instance pertama kelas ini dijadiin template default properti lain
  const newReferent = Math.max(0, ...Object.keys(p.classByReferent).map(Number)) + 1 + Math.floor(Math.random() * 1000);

  const newChunks: ChunkRaw[] = [];
  for (const c of p.chunks) {
    if (c.name === "INST" && c.data.readInt32LE(0) === classIndex) {
      const { next } = readPString(c.data, 4);
      const isService = c.data[next];
      const newReferents = [...cls.referents, newReferent];
      const refBuf = encodeInt32Array(newReferents, true);
      const head = Buffer.alloc(next + 1 + 4);
      c.data.copy(head, 0, 0, next + 1);
      head.writeInt32LE(newReferents.length, next + 1);
      newChunks.push({ name: "INST", data: Buffer.concat([head, refBuf]), modified: true });
      continue;
    }
    if (c.name === "PROP" && c.data.readInt32LE(0) === classIndex) {
      const { value: propName, next } = readPString(c.data, 4);
      const dataType = c.data[next];
      const known = KNOWN_TYPES[dataType];
      if (!known) {
        throw new Error(`Properti "${propName}" pada ${className} punya tipe data yang belum didukung KRYNOS — dibatalkan demi keamanan, tidak ada yang ditulis.`);
      }
      const valuesRaw = c.data.subarray(next + 1);
      if (known.width === null) {
        // String: split, sisipkan value baru (override kalau Name/Source, selain itu copy dari template)
        const vals = splitStringValues(valuesRaw, cls.referents.length);
        let newVal: Buffer;
        if (propName === "Name") newVal = writePString(name);
        else if (propName === "Source") newVal = writePString(source);
        else newVal = vals[templateIdx];
        const newValuesRaw = Buffer.concat([...vals, newVal]);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), newValuesRaw]), modified: true });
      } else if (known.delta) {
        // Cuma Int32/Ref yang butuh delta — width-nya udah pasti 4.
        const decoded = decodeInt32Array(valuesRaw, 0, cls.referents.length, true);
        decoded.push(decoded[templateIdx] ?? 0);
        const newValuesRaw = encodeInt32Array(decoded, true);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), newValuesRaw]), modified: true });
      } else {
        // Tipe lain (Bool/Float32/Float64/Enum/Int64/SecurityCapabilities dst)
        // — gak butuh ngerti angkanya, tinggal duplikat baris byte mentah
        // dari instance template ke lebar yang bener (1/4/8/dst byte).
        const rows = detransposeBytes(valuesRaw, 0, cls.referents.length, known.width);
        rows.push(Buffer.from(rows[templateIdx] ?? Buffer.alloc(known.width)));
        const newValuesRaw = retransposeBytes(rows);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), newValuesRaw]), modified: true });
      }
      continue;
    }
    if (c.name === "PRNT") {
      const version = c.data[0];
      const count = c.data.readInt32LE(1);
      const children = decodeInt32Array(c.data, 5, count, true);
      const parents = decodeInt32Array(c.data, 5 + count * 4, count, true);
      children.push(newReferent);
      parents.push(parentReferent);
      const childBuf = encodeInt32Array(children, true);
      const parentBuf = encodeInt32Array(parents, true);
      const head = Buffer.alloc(5);
      head[0] = version;
      head.writeInt32LE(children.length, 1);
      newChunks.push({ name: "PRNT", data: Buffer.concat([head, childBuf, parentBuf]), modified: true });
      continue;
    }
    newChunks.push({ ...c });
  }

  const newHeader = { ...p.header, numInstances: p.header.numInstances + 1 };
  const out = writeChunks(newHeader, newChunks);

  // Self-check wajib sebelum dikembalikan: parse ulang, mastiin script baru
  // muncul persis 1x, kebaca source-nya, dan nempel ke parent yang benar.
  const verify = parsePlaceFile(out);
  const vClassIndex = verify.referentToClassIndex[newReferent];
  if (vClassIndex === undefined) throw new Error("Verifikasi gagal (instance baru tidak ditemukan setelah ditulis) — DIBATALKAN, file asli aman.");
  const vSource = getScriptSource(out, newReferent);
  if (vSource !== source) throw new Error("Verifikasi gagal (source tidak cocok setelah ditulis) — DIBATALKAN, file asli aman.");
  const vParent = (verify.childrenOf[parentReferent] || []).includes(newReferent);
  if (!vParent) throw new Error("Verifikasi gagal (parent tidak sesuai) — DIBATALKAN, file asli aman.");

  return out;
}

// ----------------------------------------------------------------------------
// HAPUS script — hapus slotnya dari INST/setiap PROP kelasnya + hapus
// pasangan di PRNT. Sama seperti createScript, tipe properti di luar
// KNOWN_TYPES bikin operasi dibatalkan.
// ----------------------------------------------------------------------------
export function deleteScript(buf: Buffer, referent: number): Buffer {
  const p = parsePlaceFile(buf);
  const classIndex = p.referentToClassIndex[referent];
  if (classIndex === undefined) throw new Error("Instance tidak ditemukan.");
  const cls = p.classes[classIndex];
  if (!SCRIPT_CLASSES.has(cls.className)) throw new Error("Instance ini bukan Script/LocalScript/ModuleScript.");
  const idx = cls.referents.indexOf(referent);

  const newChunks: ChunkRaw[] = [];
  for (const c of p.chunks) {
    if (c.name === "INST" && c.data.readInt32LE(0) === classIndex) {
      const { next } = readPString(c.data, 4);
      const newReferents = cls.referents.filter((r) => r !== referent);
      const refBuf = encodeInt32Array(newReferents, true);
      const head = Buffer.alloc(next + 1 + 4);
      c.data.copy(head, 0, 0, next + 1);
      head.writeInt32LE(newReferents.length, next + 1);
      newChunks.push({ name: "INST", data: Buffer.concat([head, refBuf]), modified: true });
      continue;
    }
    if (c.name === "PROP" && c.data.readInt32LE(0) === classIndex) {
      const { value: propName, next } = readPString(c.data, 4);
      const dataType = c.data[next];
      const known = KNOWN_TYPES[dataType];
      if (!known) throw new Error(`Properti "${propName}" pada ${cls.className} punya tipe data yang belum didukung — dibatalkan demi keamanan.`);
      const valuesRaw = c.data.subarray(next + 1);
      if (known.width === null) {
        const vals = splitStringValues(valuesRaw, cls.referents.length);
        vals.splice(idx, 1);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), Buffer.concat(vals)]), modified: true });
      } else if (known.delta) {
        const decoded = decodeInt32Array(valuesRaw, 0, cls.referents.length, true);
        decoded.splice(idx, 1);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), encodeInt32Array(decoded, true)]), modified: true });
      } else {
        const rows = detransposeBytes(valuesRaw, 0, cls.referents.length, known.width);
        rows.splice(idx, 1);
        newChunks.push({ name: "PROP", data: Buffer.concat([c.data.subarray(0, next + 1), retransposeBytes(rows)]), modified: true });
      }
      continue;
    }
    if (c.name === "PRNT") {
      const version = c.data[0];
      const count = c.data.readInt32LE(1);
      const children = decodeInt32Array(c.data, 5, count, true);
      const parents = decodeInt32Array(c.data, 5 + count * 4, count, true);
      const keepIdx = children.map((_, i) => i).filter((i) => children[i] !== referent);
      const newChildren = keepIdx.map((i) => children[i]);
      const newParents = keepIdx.map((i) => parents[i]);
      const head = Buffer.alloc(5);
      head[0] = version;
      head.writeInt32LE(newChildren.length, 1);
      newChunks.push({ name: "PRNT", data: Buffer.concat([head, encodeInt32Array(newChildren, true), encodeInt32Array(newParents, true)]), modified: true });
      continue;
    }
    newChunks.push({ ...c });
  }

  const newHeader = { ...p.header, numInstances: Math.max(0, p.header.numInstances - 1) };
  const out = writeChunks(newHeader, newChunks);

  const verify = parsePlaceFile(out);
  if (verify.referentToClassIndex[referent] !== undefined) throw new Error("Verifikasi gagal (instance masih ada setelah dihapus) — DIBATALKAN, file asli aman.");

  return out;
}
