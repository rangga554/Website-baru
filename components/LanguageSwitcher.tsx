"use client";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex items-center justify-between"}>
      {!compact && <span className="text-sm text-gray-400">{t("sidebar.language")}</span>}
      <div className="flex items-center bg-black/30 border border-border rounded-lg p-0.5 text-xs font-medium">
        <button
          onClick={() => setLocale("id")}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            locale === "id" ? "bg-accent text-white" : "text-gray-400"
          }`}
        >
          ID
        </button>
        <button
          onClick={() => setLocale("en")}
          className={`px-2.5 py-1 rounded-md transition-colors ${
            locale === "en" ? "bg-accent text-white" : "text-gray-400"
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
