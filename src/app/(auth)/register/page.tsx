"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { UserPlus, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export default function RegisterPage() {
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    referralCode: "",
    terms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.terms) {
      setError("Anda harus menyetujui syarat & ketentuan");
      return;
    }

    if (form.password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    if (!captchaToken) {
      setError("Mohon selesaikan verifikasi captcha");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || null,
          referralCode: form.referralCode || null,
          captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registrasi gagal");
        return;
      }

      // Auto login after register
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        router.push("/login?registered=true");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken("");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <Card>
      <CardContent>
        <h1 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] mb-1">
          Buat Akun Baru
        </h1>
        <p className="text-sm text-muted mb-6">
          Daftar gratis dan mulai gunakan layanan KirimKode
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted mb-1.5 block">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                type="text"
                name="name"
                placeholder="Nama lengkap"
                className="pl-10"
                value={form.name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                type="email"
                name="email"
                placeholder="nama@email.com"
                className="pl-10"
                value={form.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Minimal 8 karakter"
                className="pl-10 pr-10"
                value={form.password}
                onChange={handleChange}
                required
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
          </div>

          <div>
            <label className="text-sm text-muted mb-1.5 block">No. WhatsApp (opsional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">+62</span>
              <Input
                type="tel"
                name="phone"
                placeholder="812xxxxxxxx"
                className="pl-12"
                value={form.phone}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Input
              type="text"
              name="referralCode"
              placeholder="Kode referral (opsional)"
              value={form.referralCode}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="terms"
              name="terms"
              checked={form.terms}
              onChange={handleChange}
              className="mt-1 rounded border-border accent-primary"
            />
            <label htmlFor="terms" className="text-xs text-muted">
              Saya setuju dengan{" "}
              <a href="#" className="text-primary hover:underline">
                Syarat & Ketentuan
              </a>{" "}
              dan{" "}
              <a href="#" className="text-primary hover:underline">
                Kebijakan Privasi
              </a>
            </label>
          </div>

          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
            onSuccess={setCaptchaToken}
            onError={() => setCaptchaToken("")}
            onExpire={() => setCaptchaToken("")}
            options={{ theme: "dark", size: "flexible" }}
          />

          <Button type="submit" className="w-full" size="lg" disabled={loading || !captchaToken}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mendaftar...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Daftar Sekarang
              </>
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-muted">atau</span>
          </div>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          size="lg"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Daftar dengan Google
        </Button>

        <p className="text-center text-sm text-muted mt-6">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
