import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// GUEST MODE: "/dashboard" sengaja dikecualikan dari gate login — visitor
// TANPA session boleh buka itu buat liat-liat ("Guest"), UI di dalamnya
// yang nyembunyiin/nge-disable tombol connect/simpan kalau belum login
// beneran. Rute lain (editor, AI, settings, dll) masih wajib login GitHub.
const GUEST_ALLOWED_PATHS = new Set(["/dashboard"]);

export default withAuth(
  function middleware(req) {
    // "/" itu landing page publik — kalau ternyata yang buka udah login,
    // lempar ke /dashboard di sini (bukan di dalam page.tsx). Dengan gini,
    // app/page.tsx gak perlu baca session sama sekali, jadi bisa statis
    // penuh (dapet ETag + di-cache CDN) buat visitor yang belum login.
    if (req.nextUrl.pathname === "/" && req.nextauth.token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // GATE EMAIL VERIFIKASI: cuma berlaku kalau ADA token (baik akun
    // GitHub maupun sesi akun lokal LAMA yang masih aktif — login lokal
    // baru UDAH DIHAPUS, lihat lib/auth.ts). Guest (gak ada token sama
    // sekali) otomatis lewat gate ini, gak pernah kena /verify-email.
    const token = req.nextauth.token as any;
    if (token && req.nextUrl.pathname !== "/" && !token.emailVerified) {
      return NextResponse.redirect(new URL("/verify-email", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Halaman cuma dikirim ke browser kalau ada session JWT yang valid.
      // Tanpa session valid, next-auth otomatis redirect ke /login sebelum
      // konten apapun (termasuk struktur halaman) sempat sampai ke browser.
      // KHUSUS "/" dan rute di GUEST_ALLOWED_PATHS: selalu "authorized"
      // (gak pernah dilempar ke /login) — itu yang boleh diakses Guest.
      authorized: ({ req, token }) => {
        if (req.nextUrl.pathname === "/") return true;
        if (GUEST_ALLOWED_PATHS.has(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/editor/:path*",
    "/search/:path*",
    "/users/:path*",
    "/repository/:path*",
    "/settings/:path*",
    "/survey/:path*",
    "/owner/:path*",
    "/dev/:path*",
    "/komunitas/:path*",
    "/media-sosial/:path*",
    "/code-redeem/:path*",
    "/announcement/:path*",
    "/site-inspector/:path*",
    "/project/:path*",
    "/project-ponsel/:path*",
    "/ai/:path*",
  ],
};
