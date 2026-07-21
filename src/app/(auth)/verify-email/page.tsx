"use client";

import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguageStore } from "@/store/language";

type Status = "verifying" | "success" | "error";

const REDIRECT_SECONDS = 5;

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguageStore();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const startedRef = useRef(false);

  useEffect(() => {
    // Cegah pemanggilan ganda (React strict mode) agar token single-use tidak
    // terkonsumsi dua kali dalam satu kunjungan.
    if (startedRef.current) return;
    startedRef.current = true;

    const token = searchParams.get("token") ?? "";
    if (!token) {
      setStatus("error");
      setMessage(t("emailVerify.tokenRequired"));
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/user/verify-email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("success");
          setMessage(data?.message || t("emailVerify.verified"));
        } else {
          setStatus("error");
          setMessage(data?.error?.message || t("emailVerify.invalidToken"));
        }
      } catch {
        setStatus("error");
        setMessage(t("auth.networkError"));
      }
    })();
  }, [searchParams, t]);

  // Auto-redirect ke dashboard setelah sukses (hitung mundur REDIRECT_SECONDS).
  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      router.push("/dashboard");
      return;
    }
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, router]);

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] mb-6">
          {t("emailVerify.pageTitle")}
        </h1>

        {status === "verifying" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted">{t("emailVerify.verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <div>
              <p className="font-semibold">{t("emailVerify.successTitle")}</p>
              <p className="text-sm text-muted mt-1">{message}</p>
              <p className="text-xs text-primary mt-2">
                {t("emailVerify.redirecting", { seconds: countdown })}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
              <Link
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-2.5 text-sm bg-primary text-background hover:bg-primary-hover transition-all"
              >
                {t("emailVerify.goToDashboard")}
              </Link>
              <Link
                href="/login"
                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-2.5 text-sm bg-surface text-foreground border border-border hover:bg-surface-hover transition-all"
              >
                {t("emailVerify.goToLogin")}
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <XCircle className="w-12 h-12 text-error" />
            <div>
              <p className="font-semibold">{t("emailVerify.failTitle")}</p>
              <p className="text-sm text-muted mt-1">{message}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full mt-2">
              <Link
                href="/settings"
                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-2.5 text-sm bg-primary text-background hover:bg-primary-hover transition-all"
              >
                {t("emailVerify.goToSettings")}
              </Link>
              <Link
                href="/login"
                className="flex-1 inline-flex items-center justify-center gap-2 font-semibold rounded-full px-5 py-2.5 text-sm bg-surface text-foreground border border-border hover:bg-surface-hover transition-all"
              >
                {t("emailVerify.goToLogin")}
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
