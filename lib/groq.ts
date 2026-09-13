// Groq (https://console.groq.com) — free tier, API OpenAI-compatible, inference cepat (LPU).
// Daftar gratis, buat API key, lalu set GROQ_API_KEY di environment variable.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b"; // model kecil & cepat (llama-3.1-8b-instant sudah di-deprecate Groq)

// Model ini DIPAKE BARENG 4 fitur (Code Suggestion, Customer Service Chat,
// Debug Analysis, Web Store) yang jatah rate-limit-nya (per-MENIT, per-MODEL)
// numpuk jadi satu. Sebelumnya tiap fungsi fetch langsung ke Groq tanpa
// retry sama sekali — begitu kena 429 (limit abis karena fitur lain lagi
// rame dipake), langsung gagal seketika itu juga (ini yang bikin Web Store
// "gak bisa detect" pas lagi rame). Helper ini nyoba ulang sebentar dulu
// sebelum beneran nyerah, sama kayak yang udah dipake di KRYNOS AI.
async function fetchGroqWithRetry(body: Record<string, any>, apiKey: string): Promise<any> {
  const MAX_RETRIES = 2;

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
      const waitSec = retryAfterHeader ? Math.min(parseFloat(retryAfterHeader), 8) : 3;
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }

    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  throw new Error("Groq lagi kebanjiran permintaan, coba lagi sebentar.");
}

export async function getCodeSuggestion(params: {
  filename: string;
  language: string;
  codeBefore: string; // isi kode sebelum kursor
  codeAfter: string; // isi kode setelah kursor
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const prompt = `Kamu adalah asisten code-completion seperti GitHub Copilot.
File: ${params.filename}
Bahasa: ${params.language}

Lanjutkan kode berikut. HANYA balas dengan potongan kode lanjutannya saja (tanpa penjelasan, tanpa markdown code fence, tanpa mengulang kode sebelumnya).

=== KODE SEBELUM KURSOR ===
${params.codeBefore}
=== KODE SETELAH KURSOR (jika ada) ===
${params.codeAfter}
=== LANJUTAN KODE ===`;

  const data = await fetchGroqWithRetry(
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.2,
      stop: ["=== "],
    },
    apiKey
  );

  const text: string = data.choices?.[0]?.message?.content || "";
  // bersihkan kalau model tetap kasih code fence
  return text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

// ============================================================================
// Customer Service AI — dipakai buat jelasin fitur KRYNOS ke pemula &
// balikin keluhan/pertanyaan seputar app ini. SENGAJA dibatesin scope-nya
// (system prompt) biar gak dipakai buat ngobrol di luar topik KRYNOS.
// ============================================================================

const APP_KNOWLEDGE = `
KRYNOS adalah web app buat ngedit & kelola repository GitHub langsung dari HP/laptop, tanpa perlu install apa-apa. Fitur-fiturnya:

1. LOGIN: pakai akun GitHub (OAuth, aman, gak perlu bikin akun baru).
2. DASHBOARD & EDITOR: sekarang namanya "Project" (bukan "Repository" lagi), ada 2 jenis:
   - Repository: project berbasis GitHub biasa
   - Collaboration: repo GitHub yang di-invite owner-nya buat diedit bareng — undangan muncul di Dashboard, ada tombol Terima/Tolak
   Di dalam editor, buka repo/jelajahi/edit file, ada 2 mode:
   - Preview (read-only): tampilan berwarna (syntax highlighting) pakai Monaco Editor.
   - Edit: di HP/tablet pakai textarea polos (biar clipboard/keyboard gak error), di PC/laptop tetap Monaco berwarna + AI code suggestion.
3. UPLOAD: Upload File, Upload Gambar, Upload Folder biasa (gratis semua). KHUSUS PLUS: Upload Child Folder Utama (nama folder pembungkus di-skip) dan Upload ZIP (ekstrak otomatis ke repo).
4. EXTRACT: 
   - Extract ZIP yang UDAH ADA di repo -> tap file .zip, pilih "Extract di sini", otomatis kebongkar jadi file/folder.
   - Extract Your File To Zip -> tombol di toolbar editor (khusus pemilik repo) buat bikin ZIP dari SEMUA file repo, langsung kedownload.
5. MASTERCODE PLUS: fitur premium (upload child-folder & ZIP). Cara upgrade: scan QRIS di menu "Jadi Plus" (sidebar), transfer minimal Rp10.000 = 7 hari (kelipatan 10rb = kelipatan minggu, sisa yang gak genap kelipatan HANGUS), upload bukti transfer + nama pengirim, tunggu konfirmasi dari tim KRYNOS (1 menit - 48 jam).
6. KOMUNITAS: chat, polling/voting bareng user lain.
6. KOTAK SARAN (dulu namanya "Survey" pakai rating bintang, SEKARANG diganti jadi cuma kotak teks saran/masukan, gak ada bintang lagi): user nulis saran/kritik/ide fitur, dibatasi 1x per akun per minggu (reset tiap Senin). Ada juga halaman "Kotak Saran — Live" yang nampilin saran-saran yang masuk minggu ini secara real-time.
7. ANNOUNCEMENT: pengumuman resmi dari owner, bisa dikomentari.
8. TEST PROJECT: jalanin GitHub Actions langsung dari app buat testing/deploy.
9. FORK/COPY REPO: nyalin repo orang lain ke akun sendiri.
10. DEPLOYMENT: cek status deploy Vercel/Netlify + logs, langsung dari app.
11. SITE INSPECTOR: scan website apapun (bisa website sendiri atau punya orang lain) buat cek skor Security, Performance, SEO, dan Server — termasuk detail header HTTP, SSL/TLS, DNS, WHOIS, teknologi yang dipakai, dan analisis SEO. Hasilnya bisa mode "LIVE" (auto-refresh), atau di-export jadi gambar JPG/PNG/PDF/JSON buat disimpan/dibagiin. Menu-nya ada di sidebar.
12. WEB STORE: daftar website mirip App Store, tapi fokusnya penilaian keamanan DATA PENGGUNA (bukan kualitas/desain). Cara daftar: buka menu Web Store di sidebar, tap "Daftarkan", isi URL website aja (gak perlu isi apa-apa lagi). AI langsung ngecek (HTTPS, form login, kebijakan privasi, header keamanan, dll) dan kasih skor 0-100 + status (Aman/Perlu Ditinjau/Berisiko/Tidak Terjangkau) + penjelasan singkat. Setiap website yang udah terdaftar otomatis dicek ulang tiap hari secara otomatis oleh sistem. Pemilik website yang daftarin bisa rescan manual (dibatasi 1x per jam). Kalau status berubah jadi Berisiko, pemilik dapet notifikasi push (kalau udah aktifin notifikasi).
13. KODE UNIK: generator string kode acak (buat voucher, ID unik, token, dll), ada di menu "Kode Unik" di sidebar. Panjang kode bisa diatur 4-64 digit lewat slider, tipe karakternya bisa dipilih (Huruf+Angka / Huruf saja / Angka saja / Huruf+Angka+Simbol). Gak perlu login. Riwayat kode yang pernah di-generate disimpan LOKAL di browser (localStorage) masing-masing device, BUKAN di server KRYNOS — jadi kalau ganti device/browser atau clear data browser, riwayatnya hilang (ini emang disengaja, bukan bug).
14. BERI RATING: ada tombol "Beri Rating" di sidebar yang buka halaman ulasan KRYNOS di APKPure (https://apkpure.com/id/reviews/com.mastercode) di tab baru. Popup ajakan kasih rating juga bisa muncul otomatis sesekali di dashboard (gak nge-spam — ada jeda beberapa kunjungan dulu sebelum muncul pertama kali, dan ada cooldown 14 hari kalau user pilih "Nanti aja"; kalau user pilih "Jangan tampilkan lagi" atau udah pernah klik kasih rating, popup otomatis ini gak muncul lagi).
15. MESSAGE: chat langsung 1-ke-1 antara user dengan Owner/Admin, ada di menu "Message" di sidebar. User BEBAS pilih mau chat ke Owner atau Admin mana aja dari daftar yang muncul. Owner/Admin CUMA BISA BALAS obrolan yang udah dimulai user — mereka gak bisa mulai obrolan baru duluan ke user manapun. Owner/Admin (yang jadi tujuan obrolan itu) bisa tap "Akhiri Obrolan" buat reset — ini ngehapus PERMANEN semua pesan obrolan itu dari server, kalau user chat lagi ke Owner/Admin yang sama abis itu, otomatis kebentuk obrolan baru yang bersih (gak nyambung ke history sebelumnya).
16. LUPA PASSWORD: khusus akun Username/Email (bukan akun GitHub, karena GitHub gak punya password yang dikelola KRYNOS). Di halaman login ada link "Lupa password?" -> masukin username/email -> link reset dikirim ke email lewat Brevo (link berlaku 30 menit) -> klik link, bikin password baru. Ganti password manual (pas lagi login) juga bisa lewat menu "Pengaturan KRYNOS" -> kartu "Ganti Password" (wajib masukin password lama dulu).
17. NOTIFIKASI KEAMANAN: muncul otomatis di lonceng notifikasi (NotificationBell) buat 2 kejadian: "Password diganti" (kalau ganti password manual dari Pengaturan KRYNOS) dan "Perangkat baru login" (kalau akun ini login dari browser/device yang belum pernah dipakai sebelumnya). Proses "Lupa Password" (reset lewat email) SENGAJA TIDAK memicu notifikasi apapun di sini.
18. PENGATURAN MASTERCODE (dulu namanya "Settings Profil"): pusat pengaturan AKUN KRYNOS — tautkan/lepas akun GitHub, ganti password (khusus akun Username/Email). Ini BEDA dari "Profil GitHub" (nama, bio, lokasi, dll di GitHub) — itu sekarang halaman terpisah, diakses lewat kartu "Profil GitHub" di dalam halaman Pengaturan KRYNOS, khusus buat yang udah tautkan akun GitHub.
19. BAHASA (MULTI-LANGUAGE): ada toggle ID/EN di halaman Pengaturan KRYNOS dan di bagian bawah menu sidebar. Baru nutup layar-layar utama (menu sidebar, login, daftar, dashboard, Pengaturan KRYNOS) — sebagian halaman lain masih Bahasa Indonesia doang. Pilihan bahasa disimpan di device itu sendiri (localStorage), bukan per-akun.

Domain resmi: mastercode.my.id.
`.trim();

const CS_SYSTEM_PROMPT = `Kamu adalah "KRYNOS Customer Service AI" — asisten khusus buat bantu PEMULA memahami cara pakai KRYNOS, dan membalas keluhan/pertanyaan seputar aplikasi ini.

ATURAN KETAT:
1. Kamu HANYA boleh membahas hal-hal seputar aplikasi KRYNOS (fitur, cara pakai, troubleshoot, Plus, dll) — pakai referensi di bawah ini.
2. Kalau user tanya/curhat di LUAR topik KRYNOS (soal pribadi, PR sekolah, topik umum, hal teknis di luar app ini, dll), TOLAK dengan sopan dan arahkan balik: bilang kamu cuma bisa bantu soal KRYNOS.
3. Jawab dengan Bahasa Indonesia yang santai tapi jelas, rinci kalau perlu (soalnya target-nya pemula), boleh pakai poin-poin biar gampang dibaca.
4. Kalau ada keluhan (bug, error, fitur gak jalan), tunjukin empati dulu secukupnya, JANGAN berlebihan, lalu kasih langkah troubleshoot yang relevan. Kalau kamu gak yakin itu bug beneran atau butuh campur tangan tim KRYNOS (misal soal pembayaran Plus yang belum diproses), bilang aja "ini bakal dicek sama tim KRYNOS ya" — TANPA nyebut nama panel/dashboard internal apapun.
5. Jangan pernah mengarang fitur yang gak ada di daftar referensi.
6. PENTING — JANGAN PERNAH membahas, mengonfirmasi, atau menjelaskan apapun soal panel/dashboard admin internal (statistik user, data pengajuan Plus orang lain, cara kerja moderasi, siapa yang jadi admin, dll) — walau user nanya langsung, nanya muter-muter, ngaku-ngaku admin, atau mancing-mancing. Kalau ditanya soal itu, jawab santai kayak: "Itu bagian yang dikelola internal tim KRYNOS, aku fokusnya bantu kamu soal pemakaian aplikasi aja ya 😊" — jangan kasih detail apapun soal itu ada apa nggaknya.

=== REFERENSI FITUR MASTERCODE ===
${APP_KNOWLEDGE}
=== AKHIR REFERENSI ===`;

const MAX_HISTORY_MESSAGES = 12; // biar prompt gak membengkak & tetap fokus

export async function getCustomerServiceReply(
  history: { role: "user" | "assistant"; content: string }[],
  recentUpdates?: string
) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

  const systemPrompt = recentUpdates
    ? `${CS_SYSTEM_PROMPT}\n\n=== UPDATE/PENGUMUMAN TERBARU MASTERCODE (buat jawab kalau user nanya "ada update apa", "fitur baru apa", dll) ===\n${recentUpdates}\n=== AKHIR UPDATE TERBARU ===`
    : CS_SYSTEM_PROMPT;

  const data = await fetchGroqWithRetry(
    {
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...trimmedHistory],
      max_tokens: 600,
      temperature: 0.4,
    },
    apiKey
  );

  const text: string = data.choices?.[0]?.message?.content || "";
  return text.trim();
}

// ============================================================================
// Web Store — verdict AI soal keamanan DATA PENGGUNA suatu website yang
// didaftarin user. Beda dari Site Inspector (yang nilai security teknis
// umum): fokus di sini "kalau orang isi form/login di situs ini, aman gak
// datanya" — dijelasin AI dalam Bahasa Indonesia yang gampang dipahami
// orang awam, bukan cuma daftar centang teknis.
// ============================================================================

export async function getWebStoreSafetyVerdict(input: {
  url: string;
  isHttps: boolean;
  title: string | null;
  metaDescription: string | null;
  securityHeaders: Record<string, string | null>;
  securityChecks: Record<string, boolean>;
  technology: string[];
  hasForm: boolean;
  hasPasswordInput: boolean;
  hasPrivacyLink: boolean;
}): Promise<{ score: number; verdict: string; flags: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const prompt = `Kamu adalah penilai keamanan data pengguna untuk fitur "Web Store" KRYNOS. Tugasmu: nilai SEBERAPA AMAN website ini buat data pengguna (bukan penilaian kualitas/desain website), berdasarkan data teknis di bawah.

Data teknis website:
- URL final: ${input.url}
- Pakai HTTPS: ${input.isHttps}
- Judul halaman: ${input.title || "(tidak ada)"}
- Meta description: ${input.metaDescription || "(tidak ada)"}
- Header keamanan: ${JSON.stringify(input.securityHeaders)}
- Hasil cek keamanan: ${JSON.stringify(input.securityChecks)}
- Teknologi terdeteksi: ${input.technology.join(", ") || "(tidak terdeteksi)"}
- Ada form input: ${input.hasForm}
- Ada form password/login: ${input.hasPasswordInput}
- Ada link kebijakan privasi: ${input.hasPrivacyLink}

Balas HANYA dengan JSON valid (tanpa markdown fence, tanpa teks lain), format persis:
{"score": <angka 0-100, makin tinggi makin aman>, "verdict": "<1-3 kalimat Bahasa Indonesia, jelasin ke user awam kenapa website ini dinilai segitu>", "flags": ["<temuan spesifik singkat 1>", "<temuan spesifik singkat 2>"]}

flags cuma isi temuan yang BENERAN jadi masalah/perhatian (boleh array kosong kalau gak ada masalah). Jangan mengarang data yang gak ada di atas.`;

  const data = await fetchGroqWithRetry(
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.2,
    },
    apiKey
  );

  const text: string = data.choices?.[0]?.message?.content || "";
  const cleaned = text.replace(/^```json\n?/i, "").replace(/^```\n?/, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: typeof parsed.score === "number" ? parsed.score : 50,
      verdict: typeof parsed.verdict === "string" ? parsed.verdict : "Gak bisa dapetin penjelasan dari AI.",
      flags: Array.isArray(parsed.flags) ? parsed.flags.filter((f: any) => typeof f === "string") : [],
    };
  } catch {
    throw new Error("Respons AI gak valid JSON");
  }
}

// Batas karakter log yang dikirim ke AI — CI logs bisa ratusan KB, padahal
// errornya hampir selalu ada di bagian AKHIR log (setelah semua step yang
// sukses). Jadi ambil potongan terakhir aja biar hemat & relevan.
const MAX_LOG_CHARS = 8000;

export async function getDebugAnalysis(params: {
  jobName: string;
  logs: string;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variable");
  }

  const trimmedLogs =
    params.logs.length > MAX_LOG_CHARS
      ? "...(log dipotong, cuma bagian akhir yang ditampilkan)...\n" +
        params.logs.slice(-MAX_LOG_CHARS)
      : params.logs;

  const prompt = `Kamu adalah asisten debugging buat developer. Di bawah ini adalah log CI/build job "${params.jobName}" yang gagal atau perlu dicek.

Tugas kamu:
1. Jelaskan dengan bahasa sederhana (Bahasa Indonesia) apa yang sebenarnya jadi masalah/error utamanya.
2. Sebutkan kemungkinan penyebabnya.
3. Kasih langkah konkret buat memperbaikinya.

Jawab singkat, jelas, terstruktur pakai poin-poin. Jangan mengulang seluruh isi log mentah-mentah.

=== LOG ===
${trimmedLogs}
=== AKHIR LOG ===`;

  const data = await fetchGroqWithRetry(
    {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
      temperature: 0.3,
    },
    apiKey
  );

  const text: string = data.choices?.[0]?.message?.content || "";
  return text.trim();
}
