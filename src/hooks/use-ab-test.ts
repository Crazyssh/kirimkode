"use client";

import { useState, useEffect, useCallback } from "react";

type Variant = "A" | "B";

const STORAGE_PREFIX = "kk-ab-";

/**
 * Lightweight A/B testing hook.
 * - Assigns variant randomly (50/50) on first visit
 * - Persists in localStorage so user always sees same variant
 * - Fires GA4 events for view and conversion tracking
 *
 * Usage:
 *   const { variant, trackConversion } = useABTest("whatsapp-cta");
 *   // variant === "A" or "B"
 *   // Call trackConversion() when user clicks CTA
 */
export function useABTest(testName: string): {
  variant: Variant;
  trackConversion: () => void;
} {
  const [variant, setVariant] = useState<Variant>("A");

  useEffect(() => {
    const key = STORAGE_PREFIX + testName;
    const saved = localStorage.getItem(key);

    if (saved === "A" || saved === "B") {
      setVariant(saved);
    } else {
      const assigned: Variant = Math.random() < 0.5 ? "A" : "B";
      localStorage.setItem(key, assigned);
      setVariant(assigned);
    }

    // Track view event
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "ab_test_view", {
        test_name: testName,
        variant: localStorage.getItem(key) || "A",
      });
    }
  }, [testName]);

  const trackConversion = useCallback(() => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "ab_test_conversion", {
        test_name: testName,
        variant,
      });
    }
  }, [testName, variant]);

  return { variant, trackConversion };
}
