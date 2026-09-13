import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeDns } from "@/lib/inspector/dnsLookup";
import { analyzeSsl } from "@/lib/inspector/sslCheck";
import { analyzeHttp } from "@/lib/inspector/httpInfo";
import { analyzeServer } from "@/lib/inspector/serverInfo";
import { analyzeWhois } from "@/lib/inspector/whois";
import { detectTech } from "@/lib/inspector/techDetect";
import { analyzeSeo } from "@/lib/inspector/seoCheck";
import { analyzePage } from "@/lib/inspector/pageAnalysis";
import { analyzeGeo } from "@/lib/inspector/geoip";
import { analyzeSecurity, calculateScores } from "@/lib/inspector/security";
import dns from "dns/promises";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeUrl(input: string) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

// ============================================================================
// Proteksi SSRF: tool ini fetch URL apapun yang user masukin DARI SERVER
// (bukan dari browser user), jadi kalau gak dijaga, orang bisa "nyuruh"
// server KRYNOS sendiri buat ngintip alamat internal (localhost,
// jaringan privat, endpoint metadata cloud kayak 169.254.169.254 yang
// sering nyimpen credential cloud provider). Dicek 2 lapis: nama host-nya
// langsung, DAN hasil resolusi DNS-nya (biar gak bisa dibypass pakai
// domain yang di-setting nunjuk ke IP internal / "DNS rebinding").
// ============================================================================
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIp(ip: string): boolean {
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("169.254.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

async function assertPublicHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith(".local")) {
    throw new Error("Domain/IP internal gak boleh di-scan");
  }
  if (isPrivateIp(hostname)) {
    throw new Error("Domain/IP internal gak boleh di-scan");
  }
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw new Error("Domain ini mengarah ke alamat internal, gak bisa di-scan");
      }
    }
  } catch (e: any) {
    if (e.message?.includes("internal")) throw e;
    // Gagal resolve DNS -> biarin aja, nanti analyzeHttp yang bakal gagal
    // sendiri dengan pesan error yang lebih jelas buat user.
  }
}

async function settled<T>(promise: Promise<T>, fallback: any = null) {
  try {
    return { ok: true, value: await promise };
  } catch (e: any) {
    return { ok: false, value: fallback, error: e?.message || "gagal memproses" };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawInput = body.url;
  if (!rawInput) {
    return NextResponse.json({ error: "URL wajib diisi" }, { status: 400 });
  }

  const inputUrl = normalizeUrl(rawInput);
  let domain: string;
  try {
    domain = new URL(inputUrl).hostname;
  } catch {
    return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
  }

  try {
    await assertPublicHost(domain);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  // HTTP must succeed first since other modules depend on its output
  const httpResult = await settled(analyzeHttp(inputUrl));
  if (!httpResult.ok || !httpResult.value) {
    return NextResponse.json(
      { error: "Tidak bisa terhubung ke website ini", detail: httpResult.error },
      { status: 502 }
    );
  }
  const http = httpResult.value as Awaited<ReturnType<typeof analyzeHttp>>;
  const finalDomain = new URL(http.finalUrl).hostname;

  // Cek ulang host akhir (setelah ikutin redirect) — jaga-jaga websitenya
  // sendiri redirect ke alamat internal.
  try {
    await assertPublicHost(finalDomain);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const isHttps = http.finalUrl.startsWith("https://");

  const [dnsR, sslR, whoisR, seoR, geoR] = await Promise.all([
    settled(analyzeDns(finalDomain), {}),
    settled(isHttps ? analyzeSsl(finalDomain) : Promise.resolve({ available: false, reason: "not https" }), { available: false }),
    settled(analyzeWhois(finalDomain), { available: false }),
    settled(analyzeSeo(http.html, http.finalUrl), {}),
    settled(analyzeGeo(finalDomain), {}),
  ]);

  for (const [key, r] of Object.entries({ dns: dnsR, ssl: sslR, whois: whoisR, seo: seoR, geo: geoR })) {
    if (!r.ok) errors[key] = r.error;
  }

  const server = analyzeServer(http.headers);
  const tech = detectTech(http.html, http.headers);
  const page = analyzePage(http.html, http.finalUrl);
  const security = analyzeSecurity(http.headers, http.html, isHttps, sslR.value);
  const scores = calculateScores({
    security,
    ssl: sslR.value,
    performance: { responseTime: http.responseTime, ttfb: http.ttfb },
    seo: seoR.value,
    server,
  });

  const { html, ...httpWithoutHtml } = http;

  return NextResponse.json({
    input: rawInput,
    scannedAt: new Date().toISOString(),
    general: {
      title: seoR.value?.title || null,
      metaDescription: seoR.value?.metaDescription || null,
      favicon: `https://www.google.com/s2/favicons?domain=${finalDomain}&sz=64`,
      url: inputUrl,
      finalUrl: http.finalUrl,
      httpStatus: http.httpStatus,
      httpVersion: http.httpVersion,
      contentType: http.contentType,
      contentLength: http.contentLength,
      encoding: http.encoding,
      lastModified: http.lastModified,
      redirectChain: http.redirectChain,
      responseTime: http.responseTime,
    },
    server,
    dns: dnsR.value,
    ssl: sslR.value,
    whois: whoisR.value,
    headers: http.headers,
    technology: tech,
    seo: seoR.value,
    page,
    geo: geoR.value,
    security,
    scores,
    errors,
  });
}
