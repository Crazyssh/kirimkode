import { id } from "./id";
import { en } from "./en";

export type Locale = "id" | "en";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Translations = Record<string, any>;

export const translations: Record<Locale, Translations> = { id, en };

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
