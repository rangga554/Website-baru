import type { MetadataRoute } from "next";

// Cuma landing page yang didaftarin di sitemap, sesuai robots.ts (halaman
// lain butuh login jadi gak worth di-index). Kalau nanti nambah halaman
// publik baru (misal halaman "About" atau blog), tinggal tambah entry di
// array ini.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.mastercode.my.id",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://www.mastercode.my.id/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
