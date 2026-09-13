// Service worker KRYNOS — dukung "Add to Home Screen" (PWA) dan
// caching ringan buat asset statis. SENGAJA TIDAK cache halaman (HTML)
// atau /api/* secara agresif, biar:
//   1. UpdateChecker (lib/useLivePolling + /api/version) tetap selalu
//      dapat data terbaru dari server, bukan dari cache.
//   2. Data GitHub/Groq/Vercel yang ditampilkan selalu fresh.
// Yang di-cache cuma shell statis (icon, manifest, favicon) biar app
// tetap bisa "buka" (splash/icon) walau sinyal lagi jelek.

const CACHE_NAME = "mastercode-static-v1";

const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
  "/icon-48.png",
  "/icon-96.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {
        // Kalau salah satu asset gagal di-fetch pas install (misal offline
        // pertama kali), jangan gagalin instalasi SW-nya.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cuma tangani GET, dan cuma request ke origin sendiri.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Jangan pernah cache API — data GitHub/AI/Vercel harus selalu fresh.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigasi (buka halaman): coba network dulu, fallback ke cache index
  // kalau offline. Ini yang bikin UpdateChecker tetap akurat.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/dashboard"))
    );
    return;
  }

  // Asset statis yang sudah didaftarkan di atas: cache-first, biar cepat
  // dan tetap muncul walau offline.
  if (STATIC_ASSETS.some((asset) => url.pathname === asset)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Selain itu (JS/CSS bundle Next.js, gambar lain, dll): stale-while-
  // revalidate — langsung kasih dari cache kalau ada (biar cepat), sambil
  // diam-diam update cache-nya di belakang buat request berikutnya.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});

// ============================================================================
// WEB PUSH — ini yang bikin notifikasi beneran nyampe walau app/tab udah
// ke-close total. Browser (via push service Chrome/Android) yang bangunin
// service worker ini di background pas ada push masuk, terpisah dari
// apakah tab KRYNOS lagi kebuka atau nggak.
// ============================================================================

self.addEventListener("push", (event) => {
  let data = { title: "KRYNOS", body: "Ada pembaruan baru." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // kalau payload bukan JSON valid, pakai default di atas
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      data: { url: data.url || "/dashboard" },
    })
  );
});

// Klik notifikasi -> fokusin tab KRYNOS yang udah kebuka (kalau ada),
// atau buka tab baru ke URL yang relevan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
