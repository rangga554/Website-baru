import type { MetadataRoute } from "next";

// Cuma landing page ("/") yang boleh di-index Google. Sisanya (dashboard,
// editor, settings, repository, users, search, survey, dan semua route
// /api/*) di-block karena butuh login GitHub buat diakses — kalau
// diindex, orang cuma bakal nemu halaman "please login" di hasil
// pencarian, gak ada gunanya buat SEO.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/editor",
        "/editor/",
        "/repository",
        "/repository/",
        "/users",
        "/users/",
        "/search",
        "/settings",
        "/survey",
        "/survey/",
        "/login",
        "/api/",
      ],
    },
    sitemap: "https://www.mastercode.my.id/sitemap.xml",
  };
}
