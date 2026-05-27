"use client";

import { useEffect } from "react";

const STORAGE_KEY = "kk_refresh_ts";
const POLL_INTERVAL_MS = 30_000; // 30 detik

/**
 * Polling timestamp `force_refresh_at` dari server tiap 30 detik.
 * Kalau timestamp di server lebih besar dari yang tersimpan di localStorage,
 * tab user otomatis hard refresh.
 *
 * Admin trigger via tombol "Paksa Refresh Semua User" di /admin/settings.
 */
export function RefreshWatcher() {
  useEffect(() => {
    let cancelled = false;
    let stored = 0;
    try {
      stored = Number(localStorage.getItem(STORAGE_KEY) || "0") || 0;
    } catch {
      // localStorage gak available (e.g. privacy mode) — skip
      return;
    }

    const check = async () => {
      try {
        const res = await fetch("/api/refresh-version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const ts = Number(json?.ts) || 0;

        // Initial visit — simpan baseline, jangan reload
        if (stored === 0 && ts > 0) {
          localStorage.setItem(STORAGE_KEY, String(ts));
          stored = ts;
          return;
        }

        // Server lebih baru → admin trigger refresh
        if (ts > stored) {
          localStorage.setItem(STORAGE_KEY, String(ts));
          // Hard reload dari server (bukan dari cache)
          window.location.reload();
        }
      } catch {
        // network error — silent retry next interval
      }
    };

    // First check segera (tapi delayed sedikit biar gak tabrakan dgn render awal)
    const initialTimer = setTimeout(check, 5_000);
    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
