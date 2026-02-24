"use client";

import { useState, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import dynamic from "next/dynamic";

// Lazy load — tidak dibutuhkan untuk initial render
const Toaster = dynamic(
  () => import("sonner").then((mod) => mod.Toaster),
  { ssr: false }
);

const FingerprintTracker = dynamic(
  () =>
    import("./fingerprint-tracker").then((mod) => mod.FingerprintTracker),
  { ssr: false }
);

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
