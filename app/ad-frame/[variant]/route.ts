import { NextRequest } from "next/server";

// Halaman KHUSUS buat nampilin 1 unit iklan Adsterra, di-load lewat
// <iframe src="/ad-frame/xxx"> dari AdSlot.tsx.
//
// KENAPA HARUS ROUTE TERPISAH (bukan iframe srcDoc langsung kayak versi
// awal): KRYNOS punya Content-Security-Policy ketat (lihat
// next.config.js) yang cuma ngizinin script dari domain sendiri +
// cdn.jsdelivr.net. Iframe pake "srcDoc" itu DIANGGAP SATU ORIGIN sama
// halaman induknya, jadi dia IKUT NURUTIN CSP halaman induk — akibatnya
// script Adsterra ke-block browser sebelum sempet jalan (makanya kotak
// iklannya kosong melompong, bukan gagal render, tapi emang gak dikasih
// jalan sama sekali).
//
// Dengan bikin route/URL sendiri (/ad-frame/xxx), halaman ini punya
// dokumen & CSP-nya SENDIRI (di-override khusus buat path ini doang di
// next.config.js — lihat komentar di sana), jadi script iklan bisa jalan
// normal TANPA perlu ngelonggarin CSP inti punya seluruh aplikasi.
const AD_HOST = "https://impassabletroubledwistful.com";

const BANNER_CONFIG: Record<string, { key: string; width: number; height: number }> = {
  "300x250": { key: "97c89e57011a0aa05f3240f9b1133ae4", width: 300, height: 250 },
  "320x50": { key: "61a790efb3624509d19a4ff18fc1bd9a", width: 320, height: 50 },
  "728x90": { key: "e480da2f360e3e927f1f4d50ebbfca64", width: 728, height: 90 },
};

const NATIVE_KEY = "12715caca0dfe2b70bc925e4637ab3e1";

function wrapHtml(bodyInner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;}</style>
</head>
<body>
${bodyInner}
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { variant: string } }
) {
  const variant = params.variant;

  let bodyInner: string;

  if (variant === "native") {
    bodyInner = `<div id="container-${NATIVE_KEY}"></div>
<script async data-cfasync="false" src="${AD_HOST}/${NATIVE_KEY}/invoke.js"></script>`;
  } else if (BANNER_CONFIG[variant]) {
    const cfg = BANNER_CONFIG[variant];
    bodyInner = `<script>
  atOptions = { 'key': '${cfg.key}', 'format': 'iframe', 'height': ${cfg.height}, 'width': ${cfg.width}, 'params': {} };
</script>
<script src="${AD_HOST}/${cfg.key}/invoke.js"></script>`;
  } else {
    return new Response("Ad variant tidak dikenal", { status: 404 });
  }

  return new Response(wrapHtml(bodyInner), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Halaman ini emang SENGAJA boleh di-iframe-in dari halaman lain di
      // KRYNOS sendiri (itu justru tujuannya) — X-Frame-Options global
      // punya app ini "DENY", jadi perlu di-override juga di sini biar
      // gak nge-block iframe-nya sendiri. Override utamanya tetap di
      // next.config.js (biar konsisten kena semua response dari route
      // ini), baris ini cuma jaga-jaga tambahan.
      "x-frame-options": "SAMEORIGIN",
    },
  });
}
