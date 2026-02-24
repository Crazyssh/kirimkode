"use client";

import { create } from "zustand";
import { translations, loadTranslation, getNestedValue, type Locale, type Translations } from "@/lib/i18n";

const STORAGE_KEY = "kirimkode-lang";

function detectLocale(): Locale {
  // 1. Cek localStorage
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "id" || saved === "en") return saved;

    // 2. Cek browser language
    const browserLang = navigator.language || "";
    if (browserLang.startsWith("id")) return "id";
  }

  // 3. Default: English untuk non-Indonesia
  return "en";
}

interface LanguageStore {
  locale: Locale;
  translations: Translations;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useLanguageStore = create<LanguageStore>((set, get) => {
  const initialLocale = typeof window !== "undefined" ? detectLocale() : "id";

  // Lazy load translation jika bukan 'id'
  if (initialLocale === "en" && typeof window !== "undefined") {
    loadTranslation("en").then((t) => {
      set({ translations: t });
    });
  }

  return {
    locale: initialLocale,
    translations: translations[initialLocale],

    setLocale: (locale: Locale) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, locale);
        document.documentElement.lang = locale;
      }
      // Lazy load translation jika belum ada
      loadTranslation(locale).then((t) => {
        set({ locale, translations: t });
      });
    },

    t: (key: string, params?: Record<string, string | number>): string => {
      const { translations: t } = get();
      let result = getNestedValue(t as unknown as Record<string, unknown>, key);

      // Replace {param} placeholders
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
      }

      return result;
    },
  };
});
