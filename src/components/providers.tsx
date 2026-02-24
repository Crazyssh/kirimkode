"use client";

import { useState, useEffect, type ComponentType } from "react";
import { SessionProvider } from "next-auth/react";
import { useLanguageStore } from "@/store/language";

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Lazy, setLazy] = useState<{
    Toaster: ComponentType<any> | null;
    FP: ComponentType | null;
  }>({ Toaster: null, FP: null });

  useEffect(() => {
    // Hydrate language store setelah hydration — cegah mismatch
    useLanguageStore.getState().hydrate();

    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);

    // Lazy load setelah hydration — tidak menyebabkan mismatch
    Promise.all([
      import("sonner"),
      import("./fingerprint-tracker"),
    ]).then(([sonner, fp]) => {
      setLazy({
        Toaster: sonner.Toaster,
        FP: fp.FingerprintTracker,
      });
    });

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute("data-theme") as "dark" | "light";
      if (current) setTheme(current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <SessionProvider>
      {Lazy.FP && <Lazy.FP />}
      {children}
      {Lazy.Toaster && (
        <Lazy.Toaster
          theme={theme}
          position="top-right"
          richColors
          closeButton
        />
      )}
    </SessionProvider>
  );
}
