"use client";

import { useEffect, useState } from "react";

// Cache di level modul (bukan di state komponen) — biar semua instance
// <RoleBadge> di 1 halaman (misal 30 pesan chat = 30 badge) cuma nge-fetch
// /api/admins/public SEKALI, bukan 30x. Cache-nya reset sendiri tiap kali
// halaman di-reload (SPA navigation gak reset, itu udah cukup fresh buat
// data yang jarang berubah kayak daftar admin).
let cachedLogins: Set<string> | null = null;
let inflightFetch: Promise<Set<string>> | null = null;

function fetchAdminLogins(): Promise<Set<string>> {
  if (cachedLogins) return Promise.resolve(cachedLogins);
  if (inflightFetch) return inflightFetch;

  inflightFetch = fetch("/api/admins/public")
    .then((r) => r.json())
    .then((d: { logins: string[] }) => {
      cachedLogins = new Set(d.logins || []);
      return cachedLogins;
    })
    .catch(() => new Set<string>())
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

export function useAdminLogins(): Set<string> {
  const [logins, setLogins] = useState<Set<string>>(cachedLogins || new Set());

  useEffect(() => {
    if (cachedLogins) {
      setLogins(cachedLogins);
      return;
    }
    let cancelled = false;
    fetchAdminLogins().then((set) => {
      if (!cancelled) setLogins(set);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return logins;
}
