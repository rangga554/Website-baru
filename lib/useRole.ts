"use client";

import { useEffect, useState } from "react";
import { isOwner } from "./owner";

export type Role = { isOwner: boolean; isAdmin: boolean; isDeveloper: boolean; isPrivileged: boolean; loading: boolean };

// Hook buat cek status owner/admin di komponen client.
//
// PENTING (bug lama yang udah diperbaiki): isOwner/isPrivileged SEKARANG
// dihitung LANGSUNG dari `login` di tiap render (bukan disimpen di
// useState). Sebelumnya status owner ke-"lock" di state pas render
// PERTAMA — kalau render pertama itu kejadian sebelum session NextAuth
// selesai resolve (login masih undefined sesaat), ownerNow kehitung false
// dan gak pernah ke-update lagi walau login belakangan jadi akun owner,
// soalnya useEffect di bawah cuma nge-update state buat kasus ADMIN, bukan
// buat kasus owner (buat owner sengaja di-skip biar hemat network request).
// Makanya tombol Owner Panel bisa "kadang ilang" — tergantung session-nya
// udah ke-resolve pas render pertama apa belum. Dengan isOwner dihitung
// tiap render (bukan state), masalah ini gak akan kejadian lagi: begitu
// `login` berubah jadi akun owner, isPrivileged langsung true di render
// itu juga, gak nunggu apa-apa.
//
// isAdmin tetep butuh sedikit nunggu (query ke Supabase lewat
// /api/me/role) makanya defaultnya false + loading:true sampai fetch-nya
// kelar. PENTING: halaman yang pakai hook ini buat proteksi akses (misal
// redirect kalau !isPrivileged) WAJIB nunggu loading===false dulu, biar
// admin (yang isOwner-nya false) gak ke-tendang duluan sebelum fetch-nya
// sempat balik.
//
// BUG #1 (udah diperbaiki): adminState awalnya di-init `loading: false`
// (bukan true) — bikin render pertama buat admin balikin loading:false +
// isAdmin:false sebelum fetch-nya sempat jalan → ke-redirect duluan.
// Fix: default `loading` diubah jadi `true`.
//
// BUG #2 (BARU ketemu & diperbaiki juga — ini penyebab admin masih
// ke-tendang balik ke /dashboard walau BUG #1 udah difix): pas komponen
// pertama kali mount, `login` dari NextAuth session MASIH `undefined`
// sesaat (session belum selesai resolve). Kondisi lama `if (!login ||
// ownerNow)` nganggep "login masih kosong" SAMA kayak "gak perlu
// fetch" — jadi langsung nge-set `loading: false` padahal belum tau
// user ini admin apa bukan. Begitu `login` kebaca (misal jadi akun
// admin), React re-render DULU pakai `adminState` yang MASIH nyimpen
// hasil lama itu (`loading:false`, `isAdmin:false`) — efek fetch yang
// baru (buat nge-set loading:true & mulai fetch /api/me/role) belum
// sempat jalan di render itu. Di render itu jugalah halaman /owner
// mutusin redirect, jadi kepental balik ke /dashboard SEBELUM fetch-nya
// sempat mulai, apalagi kelar. Fix: cuma short-circuit ke loading:false
// kalau `ownerNow` udah kebukti true — kalau `login` masih kosong
// (session lagi resolve), `loading` DIBIARKAN apa adanya (default true)
// sampai beneran ketauan lewat fetch atau ownerNow, gak dipaksa false.
export function useRole(login?: string | null): Role {
  const ownerNow = isOwner(login);
  const [roleState, setRoleState] = useState<{ isAdmin: boolean; isDeveloper: boolean; loading: boolean }>({
    isAdmin: false,
    isDeveloper: false,
    loading: true,
  });

  useEffect(() => {
    // Owner udah pasti privileged tanpa perlu fetch — hemat 1 request, dan
    // gak perlu nunggu apa-apa (loading langsung false lewat isOwner yang
    // sinkron di atas).
    if (ownerNow) {
      setRoleState((s) => (s.loading ? { ...s, loading: false } : s));
      return;
    }

    // `login` masih belum ada (session lagi resolve / user emang belum
    // login) — JANGAN dipaksa loading:false di sini. Biarin default
    // (true) sampai `login` beneran kebaca, biar gak ada jendela render
    // yang salah nunjukin "udah ketauan bukan admin".
    if (!login) {
      return;
    }

    let cancelled = false;
    setRoleState((s) => ({ ...s, loading: true }));

    fetch("/api/me/role")
      .then((r) => r.json())
      .then((d: { isOwner: boolean; isAdmin: boolean; isDeveloper: boolean; isPrivileged: boolean }) => {
        if (!cancelled) setRoleState({ isAdmin: d.isAdmin, isDeveloper: d.isDeveloper, loading: false });
      })
      .catch(() => {
        if (!cancelled) setRoleState((s) => ({ ...s, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [login, ownerNow]);

  return {
    isOwner: ownerNow,
    isAdmin: roleState.isAdmin,
    isDeveloper: roleState.isDeveloper,
    isPrivileged: ownerNow || roleState.isAdmin || roleState.isDeveloper,
    loading: !ownerNow && roleState.loading,
  };
}
