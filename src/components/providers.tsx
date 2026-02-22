"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { FingerprintTracker } from "./fingerprint-tracker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);

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
      <FingerprintTracker />
      {children}
      <Toaster
        theme={theme}
        position="top-right"
        richColors
        closeButton
      />
    </SessionProvider>
  );
}
