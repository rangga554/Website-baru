/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Jangan bocorin versi Next.js lewat header "X-Powered-By"
  poweredByHeader: false,

  // Paksa apex domain (mastercode.my.id) redirect 301 ke www — biar SATU
  // host doang yang jadi "canonical" di mata Google, sesuai yang udah
  // dideclare di metadataBase/JSON-LD/sitemap.ts/robots.ts (semuanya pake
  // www.mastercode.my.id). Tanpa ini, dua host bisa keindex terpisah dan
  // sinyal brand "KRYNOS" kepecah antara dua URL, bukannya numpuk ke
  // satu URL yang sama.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "mastercode.my.id" }],
        destination: "https://www.mastercode.my.id/:path*",
        permanent: true,
      },
    ];
  },

  // ETag — sebenernya ini udah default TRUE di Next.js, ditulis eksplisit
  // di sini biar jelas kesengajaannya (dan gak ke-nonaktifin gak sengaja
  // suatu saat nanti). ETag ini yang bikin browser bisa langsung "304 Not
  // Modified" buat asset yang gak berubah, gak perlu download ulang.
  generateEtags: true,

  // Security headers dasar — berlaku di semua route, termasuk /api/*.
  // Ini pelengkap, BUKAN pengganti, pengecekan session di tiap route.
  async headers() {
    // CSP ditulis 1 baris per directive biar gampang dibaca/di-maintain.
    // Beberapa 'unsafe-inline'/'unsafe-eval' TERPAKSA dipakai karena:
    // - Next.js nyisipin data hydration & sebagian script lewat inline tag
    // - Monaco Editor (dipakai di mode Preview file) butuh eval buat
    //   syntax highlighting & web worker-nya, DAN load script utamanya
    //   dari cdn.jsdelivr.net (makanya domain itu di-whitelist eksplisit
    //   di script-src/style-src/font-src/worker-src di bawah — kalau
    //   ke-skip, Preview file macet selamanya di "Loading...")
    // - Tailwind + inline style={{}} React dipakai luas di seluruh app
    // Ini trade-off yang wajar/umum buat app Next.js + code editor —
    // tetap jauh lebih aman daripada TANPA CSP sama sekali (tetap nge-
    // block eksfiltrasi data ke domain asing, script inject dari luar,
    // app di-iframe situs lain, dst).
    const csp = [
      "default-src 'self'",
      // cdn.jsdelivr.net WAJIB diizinin di sini — itu CDN tempat Monaco
      // Editor (buat mode Preview file) load script utamanya. Tanpa ini,
      // browser blokir scriptnya dan Preview macet selamanya di "Loading...".
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      "connect-src 'self' https:",
      "worker-src 'self' blob: https://cdn.jsdelivr.net",
      // Fitur Musik (app/musik) streaming audio langsung dari Jamendo lewat
      // <audio> tag — domain CDN-nya (prod-N.storage.jamendo.com) WAJIB
      // di-whitelist di sini, kalau enggak browser nge-block audio-nya
      // sebelum sempat diputer (muncul error "Gagal muter musik ini").
      "media-src 'self' https://*.jamendo.com https://*.storage.jamendo.com",
      "manifest-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        // "((?!ad-frame).*)" -> match SEMUA path KECUALI yang diawali
        // "/ad-frame" (itu punya header sendiri di bawah — CSP ketat di
        // sini bakal ngeblokir script iklan pihak ketiga kalau ikut kena
        // di situ juga).
        source: "/((?!ad-frame).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        // Halaman iklan (app/ad-frame/[variant]/route.ts) SENGAJA punya
        // CSP & X-Frame-Options sendiri, TERPISAH dari CSP ketat di atas:
        // - Iklan (Adsterra & jaringan iklan pada umumnya) bisa nge-load
        //   script/gambar/iframe dari BANYAK domain berbeda tergantung
        //   pengiklan yang lagi tayang — gak realistis di-whitelist satu
        //   per satu, makanya di sini dilonggarin ke "https:" (bukan ke
        //   "*", tetap wajib HTTPS) KHUSUS buat route ini doang.
        // - X-Frame-Options di-set "SAMEORIGIN" (bukan ikut "DENY" global)
        //   karena halaman ini MEMANG sengaja di-iframe-in dari halaman
        //   lain di KRYNOS sendiri (AdSlot.tsx) — kalau ikut "DENY",
        //   iklannya malah gak akan pernah bisa nongol sama sekali.
        // Resiko dari CSP longgar ini TERKUNCI cuma di path /ad-frame/*
        // doang — gak nyentuh/gak ngelemahin keamanan halaman lain di app.
        source: "/ad-frame/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https:",
              "frame-src https:",
              "frame-ancestors 'self'",
              "object-src https:",
            ].join("; "),
          },
        ],
      },
      {
        // Icon/gambar statis di public/ jarang banget berubah (gak kayak
        // /_next/static/ yang otomatis dapet cache super panjang karena
        // nama filenya di-hash). Kasih cache 1 hari + boleh dipakai basi
        // sampe 1 minggu selama lagi di-refresh di belakang layar —
        // balance antara "ngirit bandwidth/request" vs "gak update-nya
        // ketuker lama kalau file-nya ganti".
        source: "/:path*(png|jpg|jpeg|svg|ico|webp)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        // manifest.json & sw.js SENGAJA cache pendek — sw.js khususnya
        // gak boleh di-cache lama, biar update service worker (fitur PWA)
        // gak nyangkut di versi lama di HP orang.
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

module.exports = nextConfig;
