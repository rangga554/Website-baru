import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  // Wajib diisi biar URL relatif di openGraph (kayak "url" di bawah) resolve
  // dengan benar. GANTI kalau domain resmi kamu beda.
  metadataBase: new URL("https://www.mastercode.my.id"),
  title: {
    default: "KRYNOS",
    template: "%s — KRYNOS",
  },
  description: "KRYNOS: tempat edit, buat, hapus, dan upload file, dengan gampang dan mudahh!",
  // "site_name" ini yang jadi sinyal utama biar Google (dan platform lain
  // kayak WhatsApp/Telegram/Twitter pas link di-share) nampilin "KRYNOS"
  // sebagai nama situs, bukan cuma domain mentahnya "mastercode.my.id".
  // CATATAN: ini sinyal, bukan jaminan 100% — keputusan final tetep di Google.
  openGraph: {
    siteName: "KRYNOS",
    title: "KRYNOS",
    description: "KRYNOS: tempat edit, buat, hapus, dan upload file, dengan gampang dan mudahh!",
    url: "/",
    type: "website",
    locale: "id_ID",
    // Gambar ini yang muncul pas link mastercode.my.id di-share ke
    // WhatsApp/Telegram/Twitter/dll — tanpa ini, biasanya link cuma
    // nampilin teks polos gak ada preview gambar, dan ini juga yang
    // biasa dicek tools SEO checker (og:image).
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "KRYNOS" }],
  },
  twitter: {
    card: "summary",
    title: "KRYNOS",
    description: "KRYNOS: tempat edit, buat, hapus, dan upload file, dengan gampang dan mudahh!",
    images: ["/icon-512.png"],
  },
  // Canonical URL eksplisit — nunjukin ke Google URL "resmi" halaman ini,
  // biar gak dianggap konten duplikat kalau suatu saat diakses lewat URL
  // yang beda (misal ada query string nyangkut, atau subdomain lain).
  alternates: {
    canonical: "/",
  },
  icons: {
    // Google Search mensyaratkan ukuran favicon kelipatan 48px (48/96/144/192,
    // dst) buat bisa dipakai jadi icon di hasil pencarian — icon.png lama
    // ukurannya 1254x1254 (bukan kelipatan 48), makanya Google gak makein
    // dan nampilin globe generik. icon-*.png di bawah ini ukurannya sudah
    // bener.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  // Safari/iOS gak baca manifest.json buat mode "Add to Home Screen",
  // jadi butuh meta tag appleWebApp ini biar statusnya standalone juga
  // (address bar hilang) pas dibuka dari icon di home screen iPhone.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KRYNOS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        {/* Structured data (Schema.org) — kasih tau Google nama resmi situs
            ini "KRYNOS", biar hasil pencarian nampilin nama itu, bukan
            cuma domain "mastercode.my.id" mentah-mentah. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "KRYNOS",
              alternateName: "KRYNOS",
              url: "https://www.mastercode.my.id",
            }),
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8282815899964290"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
