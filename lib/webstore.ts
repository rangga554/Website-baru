import dns from "dns/promises";
import { analyzeHttp } from "./inspector/httpInfo";
import { analyzeSecurity } from "./inspector/security";
import { detectTech } from "./inspector/techDetect";
import { analyzeSeo } from "./inspector/seoCheck";
import { getWebStoreSafetyVerdict } from "./groq";

// ============================================================================
// WEB STORE — user daftarin website (cuma submit URL), lalu AI + pengecekan
// teknis otomatis nilai seberapa aman website itu buat DATA PENGGUNA-nya
// (bukan skor security umum kayak Site Inspector — fokusnya lebih ke
// "kalau orang isi form/login di situs ini, amankah datanya"). Dijalanin:
// - Sekali pas baru didaftarin (real-time, biar user langsung dapet hasil)
// - Otomatis ulang tiap hari lewat Vercel Cron (lihat app/api/web-store/cron-check)
//
// Reuse sebagian logic dari Site Inspector (lib/inspector/*) tapi versi
// RINGAN — sengaja SKIP whois/dns/geo/ssl-detail biar cron bisa proses
// banyak website tanpa timeout & tanpa boros kuota API pihak ketiga.
// ============================================================================

export function normalizeWebStoreUrl(input: string) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("169.254.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

// Sama kayak proteksi SSRF di Site Inspector (lib/inspector via
// app/api/inspector/scan/route.ts) — dicek terpisah di sini karena
// endpoint Web Store beda (register + cron), bukan buat dihindari, tapi
// biar 2 fitur ini gak saling gantung satu sama lain.
export async function assertPublicWebStoreHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith(".local")) {
    throw new Error("Domain/IP internal gak boleh didaftarin");
  }
  if (isPrivateIp(hostname)) {
    throw new Error("Domain/IP internal gak boleh didaftarin");
  }
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new Error("Domain ini mengarah ke alamat internal, gak bisa didaftarin");
      }
    }
  } catch (e: any) {
    if (e.message?.includes("internal")) throw e;
    // Gagal resolve DNS -> biarin, nanti fetch yang gagal duluan dengan
    // pesan lebih jelas.
  }
}

export type WebStoreCheckResult = {
  finalUrl: string;
  title: string | null;
  favicon: string;
  score: number; // 0-100, makin tinggi makin aman buat data pengguna
  status: "aman" | "perlu_ditinjau" | "berisiko";
  verdict: string; // penjelasan singkat Bahasa Indonesia dari AI
  flags: string[]; // daftar temuan spesifik (dari AI + deterministik)
  httpStatus: number;
};

function scoreToStatus(score: number): WebStoreCheckResult["status"] {
  if (score >= 70) return "aman";
  if (score >= 40) return "perlu_ditinjau";
  return "berisiko";
}

export async function runWebStoreCheck(rawUrl: string): Promise<WebStoreCheckResult> {
  const inputUrl = normalizeWebStoreUrl(rawUrl);
  const domain = new URL(inputUrl).hostname;
  await assertPublicWebStoreHost(domain);

  const http = await analyzeHttp(inputUrl);
  const finalDomain = new URL(http.finalUrl).hostname;
  await assertPublicWebStoreHost(finalDomain); // cek ulang host akhir abis redirect

  const isHttps = http.finalUrl.startsWith("https://");
  const security = analyzeSecurity(http.headers, http.html, isHttps, null);
  const tech = detectTech(http.html, http.headers);
  const seo = await analyzeSeo(http.html, http.finalUrl);

  // Sinyal deterministik tambahan yang relevan buat "keamanan data
  // pengguna" secara spesifik (bukan cuma security umum): ada form yang
  // ngirim data tapi halamannya http (bukan https), ada input password
  // tapi gak https, ada privacy policy ke-link atau nggak.
  const hasForm = /<form[\s>]/i.test(http.html);
  const hasPasswordInput = /<input[^>]+type=["']password["']/i.test(http.html);
  const hasPrivacyLink = /privacy[- ]?policy|kebijakan[- ]?privasi/i.test(http.html);
  const formOverHttp = hasForm && !isHttps;

  const deterministicFlags: string[] = [];
  if (!isHttps) deterministicFlags.push("Website belum pakai HTTPS (koneksi gak terenkripsi)");
  if (formOverHttp) deterministicFlags.push("Ada form input tapi halamannya bukan HTTPS");
  if (hasPasswordInput && !isHttps) deterministicFlags.push("Ada form login/password tapi bukan HTTPS");
  if (security.checks.mixedContent) deterministicFlags.push("Ada mixed content (resource http:// di halaman https)");
  if (!hasPrivacyLink && (hasForm || hasPasswordInput)) deterministicFlags.push("Ada form pengumpulan data tapi gak ketemu link kebijakan privasi");

  let aiResult: { score: number; verdict: string; flags: string[] };
  try {
    aiResult = await getWebStoreSafetyVerdict({
      url: http.finalUrl,
      isHttps,
      title: seo.title || null,
      metaDescription: seo.metaDescription || null,
      securityHeaders: security.headers,
      securityChecks: security.checks,
      technology: tech.map((t) => t.name),
      hasForm,
      hasPasswordInput,
      hasPrivacyLink,
    });
  } catch {
    // AI gagal (rate limit/API down) -> fallback ke skor deterministik
    // doang, biar fitur tetep jalan walau gak dapet penjelasan AI.
    const base = 100 - deterministicFlags.length * 20;
    aiResult = {
      score: Math.max(0, Math.min(100, base)),
      verdict:
        "Verdict AI gak bisa diambil saat ini (layanan AI lagi gangguan/limit), skor di bawah ini cuma dari pengecekan teknis otomatis.",
      flags: [],
    };
  }

  const allFlags = Array.from(new Set([...deterministicFlags, ...aiResult.flags]));
  const finalScore = Math.max(0, Math.min(100, Math.round(aiResult.score)));

  return {
    finalUrl: http.finalUrl,
    title: seo.title || null,
    favicon: `https://www.google.com/s2/favicons?domain=${finalDomain}&sz=64`,
    score: finalScore,
    status: scoreToStatus(finalScore),
    verdict: aiResult.verdict,
    flags: allFlags,
    httpStatus: http.httpStatus,
  };
}
