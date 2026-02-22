"use client";

import { useLanguageStore } from "@/store/language";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguageStore();

  return (
    <button
      onClick={() => setLocale(locale === "id" ? "en" : "id")}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-surface hover:bg-surface/80 border border-border transition-colors"
      title={locale === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
    >
      <span className={locale === "id" ? "text-primary font-bold" : "text-muted"}>ID</span>
      <span className="text-muted">/</span>
      <span className={locale === "en" ? "text-primary font-bold" : "text-muted"}>EN</span>
    </button>
  );
}
