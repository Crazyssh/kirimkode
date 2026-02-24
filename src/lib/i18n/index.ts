// Static import default locale (id) — selalu dibutuhkan
import { id } from "./id";

export type Locale = "id" | "en";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Translations = Record<string, any>;

// Default: 'en' pakai id sebagai placeholder, di-lazy load saat dibutuhkan
export const translations: Record<Locale, Translations> = {
  id,
  en: id,
};

/**
 * Lazy load translation file berdasarkan locale.
 * Hanya 'en' yang di-lazy load (karena 'id' sudah static import).
 */
export async function loadTranslation(locale: Locale): Promise<Translations> {
  if (locale === "en") {
    const mod = await import("./en");
    translations.en = mod.en;
    return mod.en;
  }
  return id;
}

/**
 * Ambil nested value dari object menggunakan dot-notation key.
 * Contoh: getNestedValue(obj, "status.order.waiting") → "Menunggu"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return path; // fallback: return key path jika tidak ditemukan
  }, obj);

  return typeof result === "string" ? result : path;
}
