"use client";

import { useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { downloadBlob } from "@/lib/nativeDownload";

type Size = "story" | "landscape" | "square4x5";

const SIZES: Record<Size, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: "Story (1080×1920)" },
  landscape: { w: 1920, h: 1080, label: "Landscape (1920×1080)" },
  square4x5: { w: 1080, h: 1350, label: "Instagram Portrait (1080×1350)" },
};

function scoreColor(v: number) {
  if (v >= 80) return "#5EEAD4";
  if (v >= 50) return "#F5A623";
  return "#F0546B";
}

export default function ReportCard({ data, onBusyChange }: { data: any; onBusyChange?: (busy: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>("square4x5");
  const [busy, setBusyState] = useState(false);

  function setBusy(v: boolean) {
    setBusyState(v);
    onBusyChange?.(v);
  }
  const dims = SIZES[size];
  const scale = dims.w / 540; // base template authored at 540px wide, scaled up on export

  async function render(format: "jpg" | "png") {
    if (!ref.current) return null;
    const fn = format === "jpg" ? toJpeg : toPng;
    return fn(ref.current, {
      width: dims.w,
      height: dims.h,
      pixelRatio: 1,
      quality: 0.95,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${540}px`,
        height: `${dims.h / scale}px`,
      },
      backgroundColor: "#0B1220",
      // Kalau ada gambar yang gagal ke-load (misal favicon kena CORS dari
      // domain yang di-scan), diganti pixel transparan ini aja — biar
      // proses export TETAP JALAN, bukan gagal total gara-gara 1 gambar.
      imagePlaceholder:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    });
  }

  async function download(format: "jpg" | "png") {
    setBusy(true);
    try {
      const dataUrl = await render(format);
      if (!dataUrl) return;
      const fileName = `site-inspector-${data.general.finalUrl.replace(/https?:\/\//, "").replace(/\W/g, "_")}-${size}.${format}`;
      const blob = await (await fetch(dataUrl)).blob();
      await downloadBlob(blob, fileName);
    } catch (err: any) {
      alert(`Gagal membuat gambar: ${err?.message || "terjadi kesalahan tidak terduga"}. Coba lagi, atau pakai ukuran/format lain.`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      const dataUrl = await render("png");
      if (!dataUrl) return;
      // Simple single-image PDF via a hidden print-friendly window to avoid extra heavy deps
      const win = window.open("", "_blank");
      if (!win) {
        alert("Popup diblokir browser. Izinkan popup buat situs ini, lalu coba lagi.");
        return;
      }
      win.document.write(`
        <html><head><title>Site Inspector Report</title>
        <style>@page{margin:0;size:${dims.w}px ${dims.h}px;} body{margin:0;}</style>
        </head><body><img src="${dataUrl}" style="width:100%;display:block;" /></body></html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    } catch (err: any) {
      alert(`Gagal membuat PDF: ${err?.message || "terjadi kesalahan tidak terduga"}.`);
    } finally {
      setBusy(false);
    }
  }

  async function copyImage() {
    setBusy(true);
    try {
      const dataUrl = await render("png");
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch (err: any) {
      alert(`Gagal copy gambar: ${err?.message || "browser ini mungkin tidak mendukung copy image ke clipboard"}.`);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const dataUrl = await render("png");
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "site-inspector-report.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Site Inspector Report" });
      } else {
        await download("png");
      }
    } catch (err: any) {
      // AbortError = user sendiri yang batalin share sheet-nya, bukan error beneran
      if (err?.name !== "AbortError") {
        alert(`Gagal share gambar: ${err?.message || "terjadi kesalahan tidak terduga"}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  const g = data.general;
  const s = data.scores;
  const sec = data.security.checks;

  return (
    <div className="card wide" style={{ marginTop: 14 }}>
      <div className="card-title">
        Export Report Card
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as Size)}
          style={{ background: "#0d1524", color: "#E8ECF1", border: "1px solid #223049", borderRadius: 6, padding: "4px 8px", fontFamily: "ui-monospace, monospace", fontSize: 11 }}
        >
          {Object.entries(SIZES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div style={{ overflow: "auto", maxWidth: "100%", display: "flex", justifyContent: "center", background: "#05080f", borderRadius: 8, padding: 12 }}>
        <div style={{ transform: `scale(${Math.min(1, 260 / dims.h)})`, transformOrigin: "top center" }}>
          {/* Off-screen-styled but visible preview, rendered at native template size (540 wide) then upscaled on export */}
          <div
            ref={ref}
            className="mono"
            style={{
              width: 540,
              height: dims.h / scale,
              background: "linear-gradient(160deg, #0B1220 0%, #0d1730 100%)",
              border: "1px solid #223049",
              padding: 28,
              color: "#E8ECF1",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, border: "1.5px solid #5EEAD4", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#5EEAD4", fontWeight: 700, fontSize: 12 }}>SI</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Site Inspector Report</div>
                <div style={{ fontSize: 9, color: "#7F8FA6" }}>{new Date(data.scannedAt).toLocaleString("id-ID")}</div>
              </div>
              {g.favicon && (
                <img
                  src={g.favicon}
                  width={24}
                  height={24}
                  crossOrigin="anonymous"
                  style={{ borderRadius: 5 }}
                />
              )}
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", wordBreak: "break-all" }}>{new URL(g.finalUrl).hostname}</div>
              <div style={{ fontSize: 10, color: "#7F8FA6", marginTop: 2 }}>{g.title || "—"}</div>
            </div>

            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10 }}>
              <div style={{ background: "#111A2B", border: "1px solid #223049", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#7F8FA6" }}>STATUS</div>
                <div style={{ color: g.httpStatus < 400 ? "#5EEAD4" : "#F0546B", fontWeight: 700, fontSize: 13 }}>
                  {g.httpStatus < 400 ? "ONLINE" : "ISSUE"} · {g.httpStatus}
                </div>
              </div>
              <div style={{ background: "#111A2B", border: "1px solid #223049", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#7F8FA6" }}>RESPONSE TIME</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{g.responseTime} ms</div>
              </div>
              <div style={{ background: "#111A2B", border: "1px solid #223049", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#7F8FA6" }}>IP ADDRESS</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{data.geo?.ip || "—"}</div>
              </div>
              <div style={{ background: "#111A2B", border: "1px solid #223049", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#7F8FA6" }}>LOKASI SERVER</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{data.geo?.city ? `${data.geo.city}, ${data.geo.country}` : data.geo?.country || "—"}</div>
              </div>
            </div>

            {/* Scores */}
            <div>
              <div style={{ fontSize: 10, color: "#7F8FA6", marginBottom: 6, letterSpacing: 1 }}>SKOR</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[["SECURITY", s.securityScore], ["PERFORMANCE", s.performanceScore], ["SEO", s.seoScore], ["SERVER", s.serverScore]].map(([label, val]: any) => (
                  <div key={label} style={{ textAlign: "center", background: "#111A2B", border: "1px solid #223049", borderRadius: 8, padding: "10px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(val) }}>{val}</div>
                    <div style={{ fontSize: 7.5, color: "#7F8FA6", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 8, background: "linear-gradient(90deg, #5EEAD422, transparent)", border: "1px solid #5EEAD455", borderRadius: 8, padding: "10px 0" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor(s.overall) }}>{s.overall}</div>
                <div style={{ fontSize: 8, color: "#7F8FA6", letterSpacing: 1 }}>OVERALL SCORE</div>
              </div>
            </div>

            {/* Tech badges */}
            {data.technology?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#7F8FA6", marginBottom: 6, letterSpacing: 1 }}>TEKNOLOGI</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {data.technology.slice(0, 8).map((t: any) => (
                    <span key={t.name} style={{ background: "#5EEAD422", border: "1px solid #5EEAD455", color: "#5EEAD4", fontSize: 9, padding: "4px 8px", borderRadius: 6 }}>{t.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Security */}
            <div>
              <div style={{ fontSize: 10, color: "#7F8FA6", marginBottom: 6, letterSpacing: 1 }}>KEAMANAN</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 10 }}>
                {[["HTTPS", sec.https], ["SSL", sec.sslValid], ["HSTS", sec.hsts], ["CSP", sec.csp]].map(([label, ok]: any) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "#5EEAD4" : "#F0546B", display: "inline-block" }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Domain info */}
            {data.whois?.available && (
              <div>
                <div style={{ fontSize: 10, color: "#7F8FA6", marginBottom: 6, letterSpacing: 1 }}>INFORMASI DOMAIN</div>
                <div style={{ fontSize: 10, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div>Registrar: {data.whois.registrar || "—"}</div>
                  <div>Dibuat: {data.whois.createdDate ? new Date(data.whois.createdDate).toLocaleDateString("id-ID") : "—"}</div>
                  <div>Kedaluwarsa: {data.whois.expirationDate ? new Date(data.whois.expirationDate).toLocaleDateString("id-ID") : "—"}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #223049", display: "flex", justifyContent: "space-between", fontSize: 8, color: "#7F8FA6" }}>
              <span>Dibuat menggunakan Site Inspector</span>
              <span>v2.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="export-bar">
        <button className="btn-secondary" disabled={busy} onClick={() => download("jpg")}>⬇ Download JPG</button>
        <button className="btn-secondary" disabled={busy} onClick={() => download("png")}>⬇ Download PNG</button>
        <button className="btn-secondary" disabled={busy} onClick={downloadPdf}>⬇ Download PDF</button>
        <button className="btn-secondary" disabled={busy} onClick={copyImage}>⧉ Copy Image</button>
        <button className="btn-secondary" disabled={busy} onClick={share}>↗ Share</button>
      </div>
    </div>
  );
}
