"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Shield,
  Globe,
  Clock,
  Wallet,
  ShoppingCart,
  MessageSquare,
  ChevronDown,
  Zap,
  CreditCard,
  Code,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Globe,
  Clock,
  Wallet,
  ShoppingCart,
  MessageSquare,
  Zap,
  CreditCard,
  Code,
  Users,
};

interface SellingPoint {
  icon: string;
  title: string;
  description: string;
}

interface Step {
  number: string;
  title: string;
  description: string;
}

interface FAQ {
  q: string;
  a: string;
}

interface ABVariant {
  headline: string;
  headlineHighlight: string;
  subheadline: string;
  ctaText: string;
}

interface UseCaseData {
  badge: string;
  headline: string;
  headlineHighlight: string;
  subheadline: string;
  ctaText: string;
  sellingPoints: SellingPoint[];
  steps: Step[];
  faqs: FAQ[];
  relatedBlog?: { title: string; slug: string }[];
  abTestName?: string;
  variantB?: ABVariant;
}

export function UseCaseContent({ data }: { data: UseCaseData }) {
  // A/B test: if variantB is provided, use the hook
  const abTest = data.abTestName
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      require("@/hooks/use-ab-test").useABTest(data.abTestName)
    : null;

  const isB = abTest?.variant === "B" && data.variantB;
  const headline = isB ? data.variantB!.headline : data.headline;
  const headlineHighlight = isB ? data.variantB!.headlineHighlight : data.headlineHighlight;
  const subheadline = isB ? data.variantB!.subheadline : data.subheadline;
  const ctaText = isB ? data.variantB!.ctaText : data.ctaText;

  const handleCtaClick = () => {
    abTest?.trackConversion();
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto relative text-center">
          <Badge variant="primary" className="mb-6">
            {data.badge}
          </Badge>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold font-[family-name:var(--font-space-grotesk)] leading-tight mb-6">
            {headline}{" "}
            <span className="gradient-text">{headlineHighlight}</span>
          </h1>

          <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
            {subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" onClick={handleCtaClick} className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)] px-8 py-3 text-base">
                {ctaText} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#cara-kerja" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-surface text-foreground border border-border hover:bg-surface-hover px-8 py-3 text-base">
                Lihat Cara Kerja
            </Link>
          </div>
        </div>
      </section>

      {/* Selling Points */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Keunggulan</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Mengapa Pilih <span className="text-primary">KirimKode</span>?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {data.sellingPoints.map((point) => {
              const Icon = iconMap[point.icon] || Zap;
              return (
                <Card
                  key={point.title}
                  className="hover:border-primary/30 transition-all duration-300 group"
                >
                  <CardContent>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{point.title}</h3>
                    <p className="text-sm text-muted">{point.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="cara-kerja" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Cara Kerja</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Mulai dalam <span className="text-primary">3 Langkah</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            {data.steps.map((step, i) => (
              <Card key={step.number} className="relative text-center group hover:border-primary/30 transition-all">
                <CardContent>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <span className="text-xl font-bold text-primary">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted">{step.description}</p>
                </CardContent>
                {i < data.steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/40" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="primary" className="mb-4">Platform Terpercaya</Badge>
              <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-6">
                Lebih dari <span className="text-primary">10.000+</span> pengguna mempercayai KirimKode
              </h2>
              <ul className="space-y-4">
                {[
                  "Nomor virtual dari 200+ negara",
                  "Support 500+ layanan & aplikasi",
                  "Harga mulai Rp 1.200/nomor",
                  "Refund otomatis jika OTP gagal",
                  "REST API untuk automasi",
                  "Pembayaran QRIS — semua bank & e-wallet",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="text-center">
                <CardContent>
                  <Globe className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">200+</div>
                  <div className="text-xs text-muted">Negara</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent>
                  <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">500+</div>
                  <div className="text-xs text-muted">Layanan</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent>
                  <Wallet className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">Rp 1.200</div>
                  <div className="text-xs text-muted">Mulai dari</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent>
                  <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">20 Min</div>
                  <div className="text-xs text-muted">Auto Refund</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {data.faqs.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="primary" className="mb-4">FAQ</Badge>
              <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
                Pertanyaan yang Sering Diajukan
              </h2>
            </div>

            <div className="space-y-4">
              {data.faqs.map((faq) => (
                <Card key={faq.q}>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      <ChevronDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-2">{faq.q}</h4>
                        <p className="text-sm text-muted">{faq.a}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Blog */}
      {data.relatedBlog && data.relatedBlog.length > 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="primary" className="mb-4">Artikel Terkait</Badge>
              <h2 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
                Baca Selengkapnya di Blog
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.relatedBlog.map((blog) => (
                <Link key={blog.slug} href={`/blog/${blog.slug}`}>
                  <Card className="hover:border-primary/30 transition-all cursor-pointer h-full">
                    <CardContent>
                      <h3 className="font-semibold text-sm">{blog.title}</h3>
                      <span className="text-xs text-primary mt-2 inline-flex items-center gap-1">
                        Baca artikel <ArrowRight className="w-3 h-3" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Siap untuk <span className="gradient-text">Memulai</span>?
          </h2>
          <p className="text-lg text-muted mb-8">
            Daftar sekarang dan dapatkan nomor virtual pertama Anda dalam hitungan detik.
          </p>
          <Link href="/register" onClick={handleCtaClick} className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)] px-8 py-3 text-base animate-pulse-glow">
              {ctaText} <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>
    </>
  );
}
