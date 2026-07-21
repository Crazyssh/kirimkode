"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Mail, Send, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguageStore } from "@/store/language";

export default function ForgotPasswordPage() {
  const { t, locale } = useLanguageStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Req 6.4/6.5: respons generik anti-enumerasi — selalu tampilkan sukses.
        setMessage(data?.message || t("resetPassword.requestGeneric"));
        setSent(true);
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
          {t("resetPassword.forgotTitle")}
        </h1>
        <p className="text-sm text-muted mb-6">{t("resetPassword.forgotDesc")}</p>

        {sent ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-sm text-success flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("resetPassword.backToLogin")}
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
                  {t("auth.email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    type="email"
                    name="email"
                    placeholder="nama@email.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("common.processing")}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("resetPassword.sendResetLink")}
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
