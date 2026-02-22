"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function FingerprintTracker() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    const key = `fp_sent_${session.user.id}`;
    if (sessionStorage.getItem(key)) return;

    (async () => {
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const fp = await FingerprintJS.load();
        const result = await fp.get();

        await fetch("/api/user/fingerprint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fingerprint: result.visitorId,
            screenRes: `${screen.width}x${screen.height}`,
            userAgent: navigator.userAgent,
          }),
        });

        sessionStorage.setItem(key, "1");
      } catch {
        // silent
      }
    })();
  }, [session]);

  return null;
}
