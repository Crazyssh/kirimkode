"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguageStore } from "@/store/language";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const { t, locale } = useLanguageStore();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setToken(searchParams.get("token") ?? "");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(t("resetPassword.missingToken"));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, locale }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setMessage(data?.message || t("resetPassword.passwordUpdated"));
        setDone(true);
      } else {
        setError(data?.error?.message || t("resetPassword.tryAgain"));
      }
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] mb-1">
          {t("resetPassword.resetTitle")}
        </h1>
        <p className="text-sm text-muted mb-6">{t("resetPassword.resetDesc")}</p>

        {done ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-sm text-success flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              {t("resetPassword.goToLogin")}
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1.5 block">
                  {t("resetPassword.newPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={t("resetPassword.newPassword")}
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted mt-1.5">{t("auth.passwordMin")}</p>
              </div>

              <div>
                <label className="text-sm text-muted mb-1.5 block">
                  {t("resetPassword.confirmPassword")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="confirm"
                    placeholder={t("resetPassword.confirmPassword")}
                    className="pl-10"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || !password || !confirm}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("common.processing")}
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    {t("resetPassword.updatePassword")}
                  </>
                )}
              </Button>
            </form>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline mt-6"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("resetPassword.backToLogin")}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
