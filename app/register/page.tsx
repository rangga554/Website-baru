"use client";

// Registrasi akun lokal (username/password) UDAH DIHAPUS bareng login lokal
// (lihat lib/auth.ts & app/login/page.tsx) — halaman ini cuma nge-redirect
// ke /login, biar link/bookmark lama gak 404.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
