"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dictionaries, type Locale } from "./dictionaries";

const STORAGE_KEY = "mc_locale";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "id",
  setLocale: () => {},
  t: (key) => key,
});

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default "id" — bahasa asli aplikasi ini, biar user yang belum pernah
  // milih bahasa (localStorage kosong) tetap dapet pengalaman yang sama
  // kayak sebelum fitur ini ada.
  const [locale, setLocaleState] = useState<Locale>("id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") setLocaleState(saved);
    } catch {
      // localStorage gak ke-akses -> biarin default "id"
    }
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Gagal nyimpen -> pilihan bahasa cuma berlaku sesi ini doang, gak fatal.
    }
  }

  function t(key: string): string {
    return dictionaries[locale][key] ?? dictionaries.id[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
