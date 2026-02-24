"use client";

import { create } from "zustand";
import { translations, loadTranslation, getNestedValue, type Locale, type Translations } from "@/lib/i18n";

const STORAGE_KEY = "kirimkode-lang";

function detectLocale(): Locale {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "id" || saved === "en") return saved;

    const browserLang = navigator.language || "";
    if (browserLang.startsWith("id")) return "id";
  }

  return "en";
}

interface LanguageStore {
  locale: Locale;
  translations: Translations;
  _hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  // SELALU mulai dengan "id" agar server & client render identik (cegah hydration mismatch)
  locale: "id",
  translations: translations.id,
  _hydrated: false,

  // Dipanggil di useEffect setelah hydration selesai
  hydrate: () => {
    if (get()._hydrated) return;
    const detected = detectLocale();
    set({ _hydrated: true });
    if (detected !== "id") {
      loadTranslation(detected).then((t) => {
        set({ locale: detected, translations: t });
      });
    }
  },

  setLocale: (locale: Locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    }
    loadTranslation(locale).then((t) => {
      set({ locale, translations: t });
    });
  },

  t: (key: string, params?: Record<string, string | number>): string => {
    const { translations: t } = get();
    let result = getNestedValue(t as unknown as Record<string, unknown>, key);

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
    }

    return result;
  },
}));
