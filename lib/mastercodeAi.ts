// ============================================================================
// MASTERCODE AI — asisten AI umum (mirip AI chat lainnya) yang KHUSUS punya
// satu kemampuan tambahan: bisa bikin/lanjutin PROJECT WEBSITE/APLIKASI yang
// jalan di browser — bebas banyak file & tipe file (HTML/CSS/JS/JSON/SVG/dll),
// boleh pakai framework via CDN (React, Vue, Alpine, dll), dan boleh pakai
// localStorage/IndexedDB sebagai pengganti database sederhana. Tetap gak ada
// server sungguhan yang dijalanin — cuma file yang dieksekusi di browser user.
// Beda total dari "Customer Service AI" (getCustomerServiceReply di
// lib/groq.ts) yang scope-nya dibatesin cuma bahas KRYNOS doang — AI ini
// boleh diajak ngobrol bebas kayak asisten AI pada umumnya.
//
// SENGAJA TIDAK dikasih akses apapun ke Repository/GitHub/Owner Panel/API
// internal lain — gak ada tool/function-call yang dikasih ke model, jadi
// scope-nya murni: ngobrol + generate teks kode buat project lokal (yang
// disimpen browser lewat lib/aiDb.ts, BUKAN ke repo GitHub manapun).
// ============================================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// SENGAJA beda model dari lib/groq.ts (yang dipakai CS Chat/Code Suggestion/
// Debug/Web Store — semuanya masih "openai/gpt-oss-20b"). Limit gratis Groq
// itu per-MODEL, bukan cuma per-akun — jadi kalau KRYNOS AI ikutan pakai
// model yang sama, semua fitur itu rebutan jatah 8.000 token/menit yang
// sama, gampang banget kepentok "limit mulu". Dengan model terpisah,
// KRYNOS AI punya jatah rate-limit sendiri, gak numpuk ke fitur lain.
const MODEL = "openai/gpt-oss-120b";

export type AiChatFile = { path: string; content: string };
export type AiChatProjectResult = { name: string; files: AiChatFile[] } | null;

const PROJECT_START = "<<<MASTERCODE_PROJECT>>>";
const PROJECT_END = "<<<END_PROJECT>>>";
// Versi regex yang lebih toleran dari PROJECT_START/PROJECT_END di atas —
// model (gpt-oss via Groq) kadang nulis markernya agak meleset (spasi ekstra
// di dalam "<<< >>>", atau baris kepotong) sehingga indexOf() persis gagal
// nemuin walau maksudnya sama. Dipakai sebagai fallback pencarian, BUKAN
// pengganti PROJECT_START/PROJECT_END (yang masih dipakai apa adanya di
// instruksi system prompt biar modelnya sendiri konsisten).
const PROJECT_START_RE = /<{2,}\s*MASTERCODE_PROJECT\s*>{2,}/;
const PROJECT_END_RE = /<{2,}\s*END_PROJECT\s*>{2,}/;
const FILE_MARKER_RE = /^===FILE:\s*(.+?)\s*===\s*$/gm;

// Jaring pengaman TERAKHIR: kalau semua cara di atas tetep gagal ngenalin
// blok project-nya, jangan pernah biarin kode mentah (HTML/JS panjang)
// ke-dump polos sebagai bubble chat biasa — itu yang bikin tampilan
// berantakan kayak di screenshot. Heuristik ini nebak "ini kayaknya kode,
// bukan obrolan biasa" biar bisa diganti pesan fallback yang rapi.
function looksLikeRawCodeDump(text: string): boolean {
  if (text.length < 300) return false;
  const codeSignals = [/<!DOCTYPE/i, /<html[\s>]/i, /<\/(div|body|html|head)>/i, /===FILE:/i, /<{2,}\s*MASTERCODE_PROJECT/i];
  return codeSignals.some((re) => re.test(text));
}

// Batas biar prompt gak membengkak kalau project udah gede — kirim isi file
// yang udah ada sebagai konteks (biar AI edit konsisten), tapi dipotong.
// SENGAJA diperketat (bukan cuma "biar hemat") — free tier Groq buat model
// ini cuma ~8.000 token/menit TOTAL (input + output digabung). Konteks yang
// kegedean di 1 request aja udah bisa ngabisin jatah semenit itu sendirian.
const MAX_EXISTING_FILE_CHARS = 2000;
const MAX_TOTAL_EXISTING_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 2200;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MSG_CHARS = 700; // per pesan riwayat, biar history panjang gak ngabisin token

function buildSystemPrompt(existingProject: { name: string; files: AiChatFile[] } | null): string {
  const base = `Kamu adalah "KRYNOS AI" — asisten AI serba-guna di dalam aplikasi KRYNOS, bisa diajak ngobrol bebas (nanya apa aja, brainstorming, bantu belajar, dll) SAMA SEPERTI asisten AI pada umumnya.

KEMAMPUAN KHUSUS kamu: kamu bisa BIKIN atau NGELANJUTIN sebuah "Project" berupa aplikasi/website yang jalan di browser — GAK DIBATESIN cuma 1 file index.html + style.css doang. Kamu bebas bikin:
- Berapapun jumlah file & tipe file yang perlu (banyak halaman HTML, banyak file JS/CSS, JSON buat data, SVG, manifest.json, service worker, dll) — namain file sesuai kebutuhan, gak wajib "index.html"/"style.css"/"script.js" kalau emang gak relevan (tapi HARUS tetap ada 1 file HTML utama yang jadi entry point, biar bisa langsung dibuka/di-preview).
- Framework/library JS modern via CDN kalau user minta atau emang cocok buat project-nya — misalnya React + ReactDOM + Babel standalone (buat JSX langsung di browser), Vue 3 CDN, Alpine.js, Tailwind CDN, Chart.js, Three.js, p5.js, dll. Boleh juga TypeScript kalau ditranspile client-side (mis. lewat Babel standalone) atau ditulis sebagai JS biasa dengan gaya penulisan yang mirip.
- Penyimpanan data pakai localStorage/IndexedDB di dalam project itu sendiri sebagai pengganti "database" sederhana (misal to-do list yang datanya nyimpen di browser user) — ini valid dan boleh ditawarin kalau user minta fitur yang butuh nyimpen data.

BATASAN PENTING (WAJIB dipatuhi, jangan pernah dilanggar):
- Kamu TIDAK PUNYA akses ke Repository GitHub milik user, Owner Panel, database KRYNOS, atau fitur KRYNOS lain manapun. Kalau user minta kamu buka/ubah/hapus repo GitHub mereka, jelasin dengan sopan kalau kamu cuma bisa bikin project baru yang tersimpan lokal di percakapan ini, bukan ngubah repo asli.
- Project yang kamu bikin ujung-ujungnya tetap file yang dieksekusi/dirender DI BROWSER user (gak ada proses server sungguhan yang kamu jalanin) — jadi kalau user minta hal yang butuh server asli beneran (mis. kirim email dari backend, koneksi ke database eksternal sungguhan, auth server-side, API key rahasia yang harus disembunyiin dari client), jelasin dengan jujur & singkat kalau itu di luar jangkauan (karena hasilnya file statis di browser, bukan server), terus tawarin alternatif yang tetap bisa jalan di browser (misal localStorage buat data, atau panggil API publik pihak ketiga yang emang didesain dipanggil langsung dari client).

CARA NGASIH PROJECT (WAJIB ikutin format ini persis kalau, dan CUMA kalau, user minta kamu BIKIN/LANJUTIN/UBAH sebuah website/halaman/project):
1. Tulis balasan ngobrol yang ramah & ringkas dulu (jelasin apa yang kamu buatin, JANGAN tempel kode program di balasan ini — kode bakal ditampilin otomatis lewat kartu Project terpisah oleh aplikasi, BUKAN di teks balasanmu).
2. Setelah balasan teks itu, di baris baru paling akhir, tempel BLOK berikut PERSIS (tanpa markdown code fence \`\`\` di sekitarnya, tanpa teks lain setelahnya):
${PROJECT_START}
PROJECT_NAME: Nama Project Singkat
===FILE: index.html===
<isi lengkap file index.html APA ADANYA, jangan di-escape/di-encode>
===FILE: style.css===
<isi lengkap file style.css APA ADANYA>
${PROJECT_END}

ATURAN BLOK PROJECT (PENTING, beda dari format lain yang mungkin kamu tau — WAJIB ikutin ini):
- BUKAN JSON. Tulis isi file-nya APA ADANYA (plain text asli sesuai bahasanya masing-masing — HTML/CSS/JS/JSON/SVG/dll mentah) — JANGAN dibungkus tanda kutip, JANGAN di-escape karakter apapun (jangan ubah " jadi \\", jangan ubah baris baru jadi \\n, dll). Ini yang paling sering bikin gagal kalau dilanggar.
- Baris "PROJECT_NAME: ..." WAJIB ada persis sekali di paling atas blok.
- Tiap file diawali baris persis "===FILE: nama/path/file.ext===" (tanpa spasi ekstra di dalam tanda "="), lalu isinya nempel setelah baris itu sampai marker "===FILE:" berikutnya atau sampai ${PROJECT_END}.
- Cuma tulis file yang kamu BUAT BARU atau UBAH sekarang (kalau cuma nambah 1 file baru tanpa ubah yang lain, cukup 1 blok ===FILE:=== itu aja) — file lain yang gak disebut TETAP UTUH gak akan kehapus.
- Default file utama namanya "index.html" kalau bikin project baru.
- KALAU user cuma ngobrol biasa / nanya sesuatu yang GAK minta bikin/ubah website, JANGAN PERNAH keluarin blok ${PROJECT_START} ini sama sekali — balas seperti asisten AI biasa aja.

Jawab pakai Bahasa Indonesia yang natural & ramah, kecuali user jelas-jelas nulis/nanya pakai bahasa lain. Jawab dengan runtut & fokus ke SATU topik yang lagi dibahas user — jangan loncat-loncat ke topik lain di tengah kalimat/paragraf yang sama, dan jangan tempel proses "mikir"/reasoning internal apapun ke jawaban, cukup hasil akhirnya aja yang jelas & nyambung dari kalimat pertama sampai terakhir.`;

  if (!existingProject || existingProject.files.length === 0) {
    return base;
  }

  let used = 0;
  const fileBlocks: string[] = [];
  for (const f of existingProject.files) {
    if (used >= MAX_TOTAL_EXISTING_CHARS) break;
    const remaining = MAX_TOTAL_EXISTING_CHARS - used;
    const slice = f.content.slice(0, Math.min(MAX_EXISTING_FILE_CHARS, remaining));
    const truncatedNote = slice.length < f.content.length ? "\n...(dipotong, file aslinya lebih panjang)..." : "";
    fileBlocks.push(`--- FILE: ${f.path} ---\n${slice}${truncatedNote}`);
    used += slice.length;
  }

  return `${base}

Project yang LAGI DIKERJAIN di percakapan ini bernama "${existingProject.name}". Ini isi file-filenya sekarang (buat konteks kalau user minta perubahan/lanjutan — kalau user minta ubah, keluarin lagi blok project HANYA berisi file yang berubah/baru, jangan ulang file yang gak diubah):
${fileBlocks.join("\n\n")}

PENTING KHUSUS PROJECT INI: kalau pesan user ini minta perubahan/tambahan/perbaikan ke project di atas (walau cuma sedikit, mis. "ganti warnanya", "tambahin tombol"), kamu WAJIB tetep keluarin blok ${PROJECT_START} ... ${PROJECT_END} berisi file yang berubah — JANGAN cuma jelasin perubahannya lewat kata-kata tanpa keluarin blok filenya, itu bikin perubahannya gak beneran kesimpen.`;
}

const FALLBACK_TRUNCATED_MSG =
  "Waduh, project ini kepanjangan buat sekali generate 😅 Coba kirim ulang pesan yang sama, atau minta versi yang lebih sederhana dulu (misal 1 halaman aja tanpa banyak fitur).";

function extractFiles(block: string): AiChatFile[] {
  const markers: { path: string; markerEnd: number; markerStart: number }[] = [];
  let m: RegExpExecArray | null;
  FILE_MARKER_RE.lastIndex = 0;
  while ((m = FILE_MARKER_RE.exec(block)) !== null) {
    markers.push({ path: m[1].trim(), markerEnd: m.index + m[0].length, markerStart: m.index });
  }

  const files: AiChatFile[] = [];
  for (let i = 0; i < markers.length; i++) {
    const path = markers[i].path.replace(/^\/+/, "").trim();
    if (!path) continue;
    const contentStart = markers[i].markerEnd;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].markerStart : block.length;
    let content = block
      .slice(contentStart, contentEnd)
      .replace(/^\r?\n/, "") // buang 1 baris kosong pembuka setelah marker
      .replace(/\r?\n\s*$/, "\n"); // rapiin akhir file

    // Jaring pengaman: kalau model tetep ngebungkus isi file pakai markdown
    // code fence (```html ... ```) walau udah dilarang, buang fence-nya biar
    // gak ikut kesimpen jadi bagian file.
    content = content
      .replace(/^```[a-zA-Z0-9_-]*[ \t]*\r?\n/, "")
      .replace(/\r?\n```[ \t]*\r?\n?$/, "\n");

    files.push({ path, content });
  }
  return files;
}

function parseProjectBlock(raw: string): { reply: string; project: AiChatProjectResult } {
  const startMatch = PROJECT_START_RE.exec(raw);
  const startIdx = startMatch ? startMatch.index : -1;

  if (startIdx === -1) {
    // Wrapper "<<<MASTERCODE_PROJECT>>>" gak ketemu sama sekali — tapi
    // kadang model tetep nulis marker ===FILE:=== tanpa wrapper-nya (lupa
    // format). Coba selametin: kalau ada minimal 1 marker ===FILE: valid,
    // anggap semua teks SETELAH marker pertama itu blok project-nya.
    FILE_MARKER_RE.lastIndex = 0;
    const firstFileMarker = FILE_MARKER_RE.exec(raw);
    if (firstFileMarker) {
      const before = raw.slice(0, firstFileMarker.index).trim();
      const block = raw.slice(firstFileMarker.index);
      const files = extractFiles(block);
      if (files.length > 0) {
        return { reply: before, project: { name: "Project AI", files } };
      }
    }

    // Bener-bener gak ada tanda blok project — tapi kalau isinya kayak
    // dump kode mentah (bukan obrolan wajar), jangan tampilin polos ke chat.
    if (looksLikeRawCodeDump(raw)) {
      return { reply: FALLBACK_TRUNCATED_MSG, project: null };
    }
    return { reply: raw.trim(), project: null };
  }

  const startLen = startMatch![0].length;
  const endMatch = PROJECT_END_RE.exec(raw.slice(startIdx));
  const endIdx = endMatch ? startIdx + endMatch.index : -1;

  if (endIdx === -1) {
    // Blok project KEBUKA tapi gak pernah ketutup (biasanya kehabisan token
    // pas generate project gede, walau udah dicoba disambung ulang) — JANGAN
    // pernah tampilin sisa kode mentahnya ke user, itu yang bikin chat
    // kepenuhan baris kode berantakan. Cukup teks obrolan sebelum blok itu
    // (kalau ada) + pesan fallback yang jelas.
    const before = raw.slice(0, startIdx).trim();
    return { reply: before ? `${before}\n\n${FALLBACK_TRUNCATED_MSG}` : FALLBACK_TRUNCATED_MSG, project: null };
  }

  const block = raw.slice(startIdx + startLen, endIdx);
  const endLen = endMatch![0].length;
  const reply = (raw.slice(0, startIdx) + raw.slice(endIdx + endLen)).trim();

  const nameMatch = block.match(/^\s*PROJECT_NAME:\s*(.+)$/m);
  const name = nameMatch && nameMatch[1].trim() ? nameMatch[1].trim() : "Project AI";

  // Format plain-text (BUKAN JSON) — kode file ditempel apa adanya, jadi gak
  // ada resiko "JSON rusak gara-gara AI salah escape tanda kutip/baris baru"
  // kayak format lama. Tiap file dipisah marker "===FILE: path===".
  const files = extractFiles(block);

  if (files.length === 0) {
    // Ada wrapper tapi gak ketemu ===FILE: sama sekali di dalemnya — daripada
    // reply-nya keisi sisa teks blok yang aneh, kasih fallback yang jelas.
    return { reply: looksLikeRawCodeDump(reply) ? FALLBACK_TRUNCATED_MSG : reply, project: null };
  }

  return { reply, project: { name, files } };
}

// Fetch ke Groq dengan retry otomatis kalau kena rate-limit (HTTP 429) —
// nunggu sesuai header `retry-after` dari Groq (atau backoff bertahap kalau
// headernya gak ada), maksimal 2x percobaan ulang. Kalau masih limit juga
// setelah retry, lempar error yang jelas (bukan JSON mentah dari Groq) biar
// pesannya enak dibaca user di chat.
async function fetchGroqWithRetry(body: Record<string, any>, apiKey: string): Promise<any> {
  const MAX_RETRIES = 1; // diperketat — sekarang ada juga loop lanjutan generate di atas, jaga total durasi request gak kelewat batas 60s Vercel

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return res.json();

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      const waitSec = retryAfterHeader ? Math.min(parseFloat(retryAfterHeader), 10) : 5;
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }

    if (res.status === 429) {
      throw new Error(
        "KRYNOS AI lagi kebanjiran permintaan (jatah gratis Groq buat menit ini abis). Coba lagi dalam 1-2 menit ya 🙏"
      );
    }

    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  throw new Error("KRYNOS AI lagi kebanjiran permintaan. Coba lagi sebentar ya 🙏");
}

// Jaring pengaman: model gpt-oss (via Groq) kadang bocorin token internal
// format "Harmony" (reasoning/chain-of-thought) ke jawaban akhir walau udah
// diminta disembunyikan lewat reasoning_format — ini yang bikin balasannya
// kerasa "loncat topik" di tengah kalimat (sebenernya itu potongan proses
// mikir model, bukan balasan beneran). Token-token khusus ini gak pernah
// jadi bagian teks yang wajar, jadi aman dibuang kalau ketemu.
function stripReasoningLeak(text: string): string {
  return text
    .replace(/<\|[a-z_]+\|>/gi, "")
    .replace(/^\s*(assistant|analysis|commentary|final)\s*[:\n]/i, "")
    .trim();
}

export async function getMastercodeAiReply(params: {
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  existingProject: { name: string; files: AiChatFile[] } | null;
}): Promise<{ reply: string; project: AiChatProjectResult }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const systemPrompt = buildSystemPrompt(params.existingProject);
  const trimmedHistory = params.history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.length > MAX_HISTORY_MSG_CHARS ? m.content.slice(0, MAX_HISTORY_MSG_CHARS) + "..." : m.content,
  }));

  const requestMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory,
    { role: "user", content: params.message },
  ];

  const baseBody = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
    top_p: 0.9,
    // Model gpt-oss punya mode "reasoning" (mikir dulu baru jawab) yang
    // sumber utama balasan kerasa gak nyambung/loncat topik — matiin
    // seminimal mungkin (low) & paksa reasoning-nya gak nyampur ke
    // jawaban akhir (hidden), biar balasannya lurus & konsisten.
    reasoning_effort: "low" as const,
    reasoning_format: "hidden" as const,
  };

  // Project yang gede (banyak file/kode) bisa kepotong kehabisan token
  // sebelum blok ${PROJECT_END} sempet ditulis. Daripada nampilin kode
  // mentah yang kepotong ke chat, coba SAMBUNG generate-nya otomatis
  // (maks beberapa kali) sampai blok-nya beneran ketutup.
  const MAX_CONTINUATIONS = 2;
  let accumulated = "";

  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    const data = await fetchGroqWithRetry({ ...baseBody, messages: requestMessages }, apiKey);
    const choice = data.choices?.[0];
    const piece: string = choice?.message?.content || "";
    accumulated += piece;

    const wasTruncated = choice?.finish_reason === "length";
    const projectStillOpen = PROJECT_START_RE.test(accumulated) && !PROJECT_END_RE.test(accumulated);

    if (!wasTruncated || !projectStillOpen || round === MAX_CONTINUATIONS) break;

    requestMessages.push({ role: "assistant", content: piece });
    requestMessages.push({
      role: "user",
      content:
        "Lanjutkan PERSIS dari karakter terakhir yang barusan kamu tulis (jangan ulang dari awal, jangan tulis ulang bagian yang udah ada) sampai bloknya beneran selesai dan ditutup dengan " +
        PROJECT_END,
    });
  }

  const text = stripReasoningLeak(accumulated);
  return parseProjectBlock(text);
}
