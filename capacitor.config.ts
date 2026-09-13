import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.mastercode',
  appName: 'KRYNOS',
  // PENTING: Next.js app ini pakai API routes, middleware, NextAuth (SSR).
  // Nggak bisa di-"static export" biasa. Jadi Capacitor di-set load
  // website LIVE kamu langsung (server.url), bukan bundle file lokal.
  // Ini beda dari default Capacitor (yang biasanya load dari ./out),
  // tapi ini pola yang BENAR buat app Next.js dinamis kayak ini.
  server: {
    url: 'https://www.mastercode.my.id',
    cleartext: false,
    // Default-nya Capacitor cuma izinin navigasi ke domain website
    // sendiri di dalam WebView app — link ke domain lain otomatis
    // dilempar ke browser luar (Chrome), yang bikin OAuth GitHub
    // "kabur" dari app dan session-nya nggak nyambung balik.
    // Domain-domain OAuth GitHub perlu di-whitelist biar tetap dibuka
    // DI DALAM app.
    allowNavigation: [
      'github.com',
      '*.github.com',
    ],
  },
  android: {
    // Biar WebView bisa akses localhost kalau nanti butuh debug,
    // dan supaya cookie session NextAuth kebawa normal antar-request.
    allowMixedContent: false,
  },
};

export default config;
