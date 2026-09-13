"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { downloadBlob } from "@/lib/nativeDownload";
import InspectorScoreCircle from "@/components/InspectorScoreCircle";
import InspectorReportCard from "@/components/InspectorReportCard";

const STEPS = [
  "Menghubungi server & mengikuti redirect...",
  "Membaca header HTTP & mendeteksi CDN/WAF...",
  "Melakukan DNS lookup (A, AAAA, MX, TXT, NS)...",
  "Memeriksa sertifikat SSL/TLS...",
  "Mengambil data WHOIS / RDAP...",
  "Mendeteksi teknologi yang digunakan...",
  "Menganalisis SEO & structured data...",
  "Mencari lokasi server (GeoIP)...",
  "Menghitung skor keamanan, performa & SEO...",
];

function statusColor(status: number) {
  if (status >= 200 && status < 300) return "dot-green";
  if (status >= 300 && status < 500) return "dot-yellow";
  return "dot-red";
}

function KV({ k, v }: { k: string; v: any }) {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  return (
    <div className="kv-row">
      <span className="kv-key">{k}</span>
      <span className="kv-val">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
    </div>
  );
}

// Jeda minimum antar-refresh live (ms).
const LIVE_MIN_DELAY = 1200;
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function SiteInspectorPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const stepTimer = useRef<any>(null);
  const liveModeRef = useRef(true);
  const exportBusyRef = useRef(false);
  const activeTargetRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);

  useEffect(() => {
    exportBusyRef.current = exportBusy;
  }, [exportBusy]);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      activeTargetRef.current = null;
    };
  }, []);

  async function backgroundPoll(target: string) {
    if (pollingRef.current) return;
    pollingRef.current = true;
    activeTargetRef.current = target;

    while (activeTargetRef.current === target) {
      if (!liveModeRef.current || exportBusyRef.current) {
        await sleep(300);
        continue;
      }
      const started = Date.now();
      try {
        const res = await fetch("/api/inspector/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target }),
        });
        const data = await res.json();
        if (res.ok && activeTargetRef.current === target) {
          setResult(data);
          setLastUpdated(Date.now());
        }
      } catch {
        // diamkan error di background; coba lagi di iterasi berikutnya
      }
      const elapsed = Date.now() - started;
      await sleep(Math.max(0, LIVE_MIN_DELAY - elapsed));
    }
    pollingRef.current = false;
  }

  function toggleLive() {
    setLiveMode((v) => {
      const next = !v;
      if (next && activeTargetRef.current && !pollingRef.current) {
        backgroundPoll(activeTargetRef.current);
      }
      return next;
    });
  }

  async function runScan(targetUrl?: string) {
    const target = targetUrl ?? url;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStepIndex(0);
    setProgress(4);

    stepTimer.current = setInterval(() => {
      setStepIndex((i) => {
        const next = Math.min(i + 1, STEPS.length - 1);
        setProgress(Math.min(94, ((next + 1) / STEPS.length) * 100));
        return next;
      });
    }, 550);

    try {
      const res = await fetch("/api/inspector/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      clearInterval(stepTimer.current);
      if (!res.ok) {
        setError(data.error || "Scan gagal");
        setLoading(false);
        return;
      }
      setStepIndex(STEPS.length - 1);
      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setLastUpdated(Date.now());
        setLoading(false);
        activeTargetRef.current = target;
        backgroundPoll(target);
      }, 300);
    } catch (e) {
      clearInterval(stepTimer.current);
      setError("Tidak bisa terhubung ke server");
      setLoading(false);
    }
  }

  function copyJson() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  }

  async function downloadJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const fileName = `site-inspector-${result.general.finalUrl.replace(/https?:\/\//, "").replace(/\W/g, "_")}.json`;
    await downloadBlob(blob, fileName);
  }

  return (
    <div className="si-scope">
      <div className="container">
        <div className="topbar" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="logo-mark">SI</div>
            <div>
              <div className="brand-name">Site Inspector</div>
              <div className="brand-tag">v2.0 — domain &amp; security intelligence</div>
            </div>
          </div>
          <Link href="/dashboard" className="btn-secondary" style={{ textDecoration: "none" }}>
            Kembali
          </Link>
        </div>

        <div className="scan-panel">
          <div className="scan-input-row">
            <input
              className="scan-input"
              placeholder="masukkan URL atau domain, mis. example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runScan()}
              disabled={loading}
            />
            <button className="scan-btn" onClick={() => runScan()} disabled={loading}>
              {loading ? "SCANNING..." : "SCAN"}
            </button>
          </div>

          {loading && (
            <>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="terminal-log">
                {STEPS.map((s, i) => (
                  <div key={s} className={`terminal-line ${i < stepIndex ? "done" : i === stepIndex ? "" : "pending"}`}>
                    <span className="glyph">{i < stepIndex ? "✓" : i === stepIndex ? ">" : "·"}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <div className="warning-text">⚠ {error}</div>}

          {!loading && !result && !error && (
            <div className="empty-state">Masukkan URL di atas dan tekan SCAN untuk mulai analisis.</div>
          )}
        </div>

        {result && (
          <>
            <div className="live-bar">
              <span className={`dot ${liveMode && !exportBusy ? "dot-green live-pulse" : "dot-yellow"}`} />
              <span className="mono live-label">
                {exportBusy ? "DIJEDA · sedang export" : liveMode ? "LIVE" : "DIJEDA"}
                {lastUpdated && ` · diperbarui ${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))} detik lalu`}
              </span>
              <button className="btn-secondary live-toggle" onClick={toggleLive}>
                {liveMode ? "⏸ Jeda" : "▶ Lanjutkan"}
              </button>
            </div>

            <div className="section-grid" style={{ marginTop: 12 }}>
              <div className="card wide">
                <div className="card-title">Skor Keseluruhan</div>
                <div className="score-grid">
                  <InspectorScoreCircle label="Security" value={result.scores.securityScore} />
                  <InspectorScoreCircle label="Performance" value={result.scores.performanceScore} />
                  <InspectorScoreCircle label="SEO" value={result.scores.seoScore} />
                  <InspectorScoreCircle label="Server" value={result.scores.serverScore} />
                  <InspectorScoreCircle label="Overall" value={result.scores.overall} />
                </div>
              </div>
            </div>

            <div className="section-grid">
              <div className="card wide">
                <div className="card-title">Informasi Umum</div>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <img src={result.general.favicon} width={32} height={32} alt="favicon" style={{ borderRadius: 6 }} />
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <KV k="Judul" v={result.general.title} />
                    <KV k="Meta Description" v={result.general.metaDescription} />
                    <KV k="URL" v={result.general.url} />
                    <KV k="URL Akhir" v={result.general.finalUrl} />
                    <div className="kv-row">
                      <span className="kv-key">HTTP Status</span>
                      <span className="kv-val">
                        <span className={`dot ${statusColor(result.general.httpStatus)}`} style={{ marginRight: 6 }} />
                        {result.general.httpStatus}
                      </span>
                    </div>
                    <KV k="Content-Type" v={result.general.contentType} />
                    <KV k="Content-Length" v={result.general.contentLength} />
                    <KV k="Encoding" v={result.general.encoding} />
                    <KV k="Last-Modified" v={result.general.lastModified} />
                    <KV k="Response Time" v={`${result.general.responseTime} ms`} />
                    <KV k="Redirect" v={result.general.redirectChain?.length > 1 ? `${result.general.redirectChain.length} hop` : "Tidak ada"} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">Informasi Server</div>
                <KV k="Server" v={result.server.server} />
                <KV k="X-Powered-By" v={result.server.poweredBy} />
                <KV k="Reverse Proxy" v={result.server.reverseProxy} />
                <KV k="CDN" v={result.server.cdn} />
                <KV k="WAF" v={result.server.waf} />
                <KV k="HTTP/3" v={result.server.http3 ? "Ya" : "Tidak"} />
                <KV k="Compression" v={result.server.compression} />
                <KV k="Keep-Alive" v={result.server.keepAlive} />
              </div>

              <div className="card">
                <div className="card-title">SSL / TLS</div>
                {result.ssl?.available ? (
                  <>
                    <div className="kv-row">
                      <span className="kv-key">Status</span>
                      <span className="kv-val">
                        <span className={`dot ${result.ssl.expired ? "dot-red" : result.ssl.daysRemaining < 14 ? "dot-yellow" : "dot-green"}`} style={{ marginRight: 6 }} />
                        {result.ssl.expired ? "Kedaluwarsa" : "Aktif"}
                      </span>
                    </div>
                    <KV k="Common Name" v={result.ssl.commonName} />
                    <KV k="Issuer" v={result.ssl.issuer?.O || result.ssl.issuer?.CN} />
                    <KV k="Valid Until" v={result.ssl.validTo} />
                    <KV k="Sisa Masa Berlaku" v={`${result.ssl.daysRemaining} hari`} />
                    <KV k="TLS Version" v={result.ssl.tlsVersion} />
                    <KV k="Cipher" v={result.ssl.cipher} />
                    <KV k="Self-Signed" v={result.ssl.selfSigned ? "Ya" : "Tidak"} />
                  </>
                ) : (
                  <div className="warning-text">⚠ SSL tidak tersedia / gagal diperiksa</div>
                )}
              </div>

              <div className="card">
                <div className="card-title">DNS Records</div>
                <KV k="A" v={result.dns.a} />
                <KV k="AAAA" v={result.dns.aaaa} />
                <KV k="NS" v={result.dns.ns} />
                <KV k="MX" v={result.dns.mx?.map((m: any) => m.exchange)} />
                <KV k="CNAME" v={result.dns.cname} />
                <KV k="SPF" v={result.dns.spf ? "Ada" : "Tidak ada"} />
                <KV k="DKIM" v={result.dns.dkim ? "Terdeteksi" : "Tidak terdeteksi"} />
                <KV k="DMARC" v={result.dns.dmarc ? "Ada" : "Tidak ada"} />
                <KV k="PTR" v={result.dns.ptr} />
              </div>

              <div className="card">
                <div className="card-title">WHOIS / RDAP</div>
                {result.whois?.available ? (
                  <>
                    <KV k="Domain" v={result.whois.domain} />
                    <KV k="Registrar" v={result.whois.registrar} />
                    <KV k="Dibuat" v={result.whois.createdDate} />
                    <KV k="Diperbarui" v={result.whois.updatedDate} />
                    <KV k="Kedaluwarsa" v={result.whois.expirationDate} />
                    <KV k="Status" v={result.whois.status} />
                    <KV k="Name Server" v={result.whois.nameServers} />
                  </>
                ) : (
                  <div className="warning-text">⚠ Data WHOIS tidak tersedia</div>
                )}
              </div>

              <div className="card">
                <div className="card-title">Geolokasi Server</div>
                <KV k="IP" v={result.geo.ip} />
                <KV k="IPv6" v={result.geo.ipv6} />
                <KV k="Negara" v={result.geo.country} />
                <KV k="Kota" v={result.geo.city} />
                <KV k="ISP" v={result.geo.isp} />
                <KV k="ASN" v={result.geo.asn} />
                <KV k="Timezone" v={result.geo.timezone} />
                {result.geo.error && <div className="warning-text">⚠ {result.geo.error}</div>}
              </div>

              <div className="card wide">
                <div className="card-title">Teknologi Terdeteksi</div>
                {result.technology.length > 0 ? (
                  <div className="badge-wrap">
                    {result.technology.map((t: any) => (
                      <span key={t.name} className="badge">{t.name}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "var(--si-text-secondary)", fontSize: 13 }}>Tidak ada teknologi spesifik yang terdeteksi.</span>
                )}
              </div>

              <div className="card wide">
                <div className="card-title">Header Keamanan HTTP</div>
                {Object.entries(result.security.headers).map(([k, v]: any) => (
                  <div key={k} className="header-flag">
                    <span>{k}</span>
                    <span style={{ color: v ? "var(--si-accent)" : "var(--si-error)" }}>{v ? "✓ Ada" : "✕ Tidak ada"}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">SEO</div>
                <KV k="Title" v={`${result.seo.titleLength} karakter`} />
                <KV k="Meta Desc" v={result.seo.metaDescription ? `${result.seo.metaDescriptionLength} karakter` : "Tidak ada"} />
                <KV k="Canonical" v={result.seo.canonical ? "Ada" : "Tidak ada"} />
                <KV k="Robots.txt" v={result.seo.robotsTxt ? "Ada" : "Tidak ada"} />
                <KV k="Sitemap.xml" v={result.seo.sitemapXml ? "Ada" : "Tidak ada"} />
                <KV k="H1 Count" v={result.seo.h1Count} />
                <KV k="Open Graph" v={Object.keys(result.seo.openGraph || {}).length > 0 ? "Ada" : "Tidak ada"} />
                <KV k="Structured Data" v={result.seo.structuredData?.length > 0 ? `${result.seo.structuredData.length} blok` : "Tidak ada"} />
                <KV k="Bahasa" v={result.seo.language} />
                <KV k="Gambar tanpa Alt" v={`${result.seo.imagesWithoutAlt} / ${result.seo.imagesTotal}`} />
              </div>

              <div className="card">
                <div className="card-title">Analisis Halaman</div>
                <KV k="Script" v={result.page.scripts} />
                <KV k="CSS" v={result.page.stylesheets} />
                <KV k="Gambar" v={result.page.images} />
                <KV k="Link Internal" v={result.page.internalLinks} />
                <KV k="Link Eksternal" v={result.page.externalLinks} />
                <KV k="iframe" v={result.page.iframes} />
                <KV k="Form" v={result.page.forms} />
                <KV k="Video" v={result.page.videos} />
              </div>
            </div>

            <div className="export-bar">
              <button className="btn-secondary" onClick={downloadJson}>⬇ Export JSON</button>
              <button className="btn-secondary" onClick={copyJson}>⧉ Copy JSON</button>
            </div>

            <InspectorReportCard data={result} onBusyChange={setExportBusy} />
          </>
        )}
      </div>
    </div>
  );
}
