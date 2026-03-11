"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Zap,
  Shield,
  Globe,
  Clock,
  CreditCard,
  Code,
  MessageSquare,
  Send,
  Users,
  ArrowRight,
  ChevronDown,
  Wallet,
  ShoppingCart,
  Star,
  Quote,
} from "lucide-react";
import { useLanguageStore } from "@/store/language";

// ==================== ANIMATED COUNTER HOOK ====================

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();

          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutQuart for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

// ==================== SERVICE ICONS (SVG) ====================

const serviceIcons: Record<string, React.ReactNode> = {
  WhatsApp: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  Telegram: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#26A5E4">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#E4405F">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z"/>
    </svg>
  ),
  TikTok: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  "Twitter/X": (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  Google: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#4285F4">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  ),
  Discord: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#5865F2">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
    </svg>
  ),
  Shopee: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#EE4D2D">
      <path d="M18.536 2.671A11.965 11.965 0 0012 .003a11.965 11.965 0 00-6.536 2.668L12 7.556l6.536-4.885zm4.893 6.074L12 17.206.571 8.745A11.974 11.974 0 000 12.003c0 6.627 5.373 12 12 12s12-5.373 12-12c0-1.14-.171-2.243-.474-3.284l-.097.026z"/>
    </svg>
  ),
  Tokopedia: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#42B549">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 3c1.654 0 3 1.346 3 3s-1.346 3-3 3-3-1.346-3-3 1.346-3 3-3zm0 14c-2.757 0-5.185-1.404-6.614-3.54C6.984 13.56 10 12.5 12 12.5s5.016 1.06 6.614 2.96C17.185 17.596 14.757 19 12 19z"/>
    </svg>
  ),
  Grab: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#00B14F">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 14.2c-.472 2.468-2.687 4.332-5.332 4.332-2.984 0-5.412-2.428-5.412-5.412 0-2.645 1.864-4.86 4.332-5.332v2.072c-1.34.432-2.26 1.672-2.26 3.14 0 1.848 1.492 3.34 3.34 3.34 1.468 0 2.708-.92 3.14-2.26h2.192v.12z"/>
    </svg>
  ),
  DANA: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#108EE9">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm2.4 16.8H7.2V7.2h7.2c2.651 0 4.8 2.149 4.8 4.8s-2.149 4.8-4.8 4.8z"/>
    </svg>
  ),
};

export function HomeContent() {
  const { t } = useLanguageStore();

  // Animated counters
  const counter200 = useCountUp(200, 2000);
  const counter500 = useCountUp(500, 2000);
  const counter10K = useCountUp(10, 2000);
  const counter1M = useCountUp(1, 2000);

  const statsAnimated = [
    { label: t("landing.statsCountries"), value: counter200.count, suffix: "+", ref: counter200.ref, icon: Globe },
    { label: t("landing.statsServices"), value: counter500.count, suffix: "+", ref: counter500.ref, icon: MessageSquare },
    { label: t("landing.statsUsers"), value: counter10K.count, suffix: "K+", ref: counter10K.ref, icon: Users },
    { label: t("landing.statsOtp"), value: counter1M.count, suffix: "M+", ref: counter1M.ref, icon: Send },
  ];

  const features = [
    {
      icon: Zap,
      title: t("landing.featureInstant"),
      description: t("landing.featureInstantDesc"),
    },
    {
      icon: Globe,
      title: t("landing.featureCountries"),
      description: t("landing.featureCountriesDesc"),
    },
    {
      icon: Shield,
      title: t("landing.featureSecure"),
      description: t("landing.featureSecureDesc"),
    },
    {
      icon: CreditCard,
      title: t("landing.featurePrice"),
      description: t("landing.featurePriceDesc"),
    },
    {
      icon: Code,
      title: t("landing.featureApi"),
      description: t("landing.featureApiDesc"),
    },
    {
      icon: Clock,
      title: t("landing.featureOnline"),
      description: t("landing.featureOnlineDesc"),
    },
  ];

  const otpPrices = [
    { service: "WhatsApp", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1500, available: 342, popular: true },
    { service: "Telegram", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1200, available: 521, popular: true },
    { service: "Facebook", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2000, available: 189, popular: true },
    { service: "Instagram", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2500, available: 156, popular: false },
    { service: "TikTok", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1800, available: 278, popular: false },
    { service: "Google", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 3000, available: 67, popular: false },
    { service: "Twitter / X", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2200, available: 94, popular: false },
    { service: "Discord", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1500, available: 445, popular: false },
    { service: "Shopee", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1200, available: 389, popular: false },
    { service: "WhatsApp", country: "\ud83c\uddfa\ud83c\uddf8 Amerika", price: 5250, available: 120, popular: false },
    { service: "Telegram", country: "\ud83c\uddfa\ud83c\uddf8 Amerika", price: 4200, available: 98, popular: false },
    { service: "WhatsApp", country: "\ud83c\uddee\ud83c\uddf3 India", price: 1200, available: 890, popular: false },
  ];

  const howItWorks = [
    {
      step: "1",
      title: t("landing.step1Title"),
      description: t("landing.step1Desc"),
      icon: Wallet,
    },
    {
      step: "2",
      title: t("landing.step2Title"),
      description: t("landing.step2Desc"),
      icon: ShoppingCart,
    },
    {
      step: "3",
      title: t("landing.step3Title"),
      description: t("landing.step3Desc"),
      icon: MessageSquare,
    },
  ];

  const testimonials = [
    {
      name: "Andi Pratama",
      role: "Digital Marketer",
      stars: 5,
      text: "KirimKode sangat membantu untuk manage multi-akun social media. Harga terjangkau dan OTP selalu masuk cepat. Sudah pakai lebih dari 6 bulan, gak pernah kecewa!",
    },
    {
      name: "Sarah Wijaya",
      role: "QA Engineer",
      stars: 5,
      text: "Buat testing aplikasi, KirimKode jadi andalan tim kami. API-nya mudah diintegrasikan ke pipeline CI/CD. One-click dan nomor langsung ready.",
    },
    {
      name: "Rizky Fadillah",
      role: "Content Creator",
      stars: 5,
      text: "Saya pakai KirimKode untuk verifikasi akun TikTok dan Instagram. Prosesnya cepat, harga murah, dan yang paling penting nomor-nya selalu tersedia.",
    },
    {
      name: "Dewi Lestari",
      role: "Freelancer",
      stars: 4,
      text: "Deposit via QRIS sangat praktis. Refund otomatis kalau OTP gak masuk juga bikin tenang. Recommended banget buat yang butuh verifikasi OTP!",
    },
    {
      name: "Budi Santoso",
      role: "Developer",
      stars: 5,
      text: "REST API-nya well-documented dan responsenya konsisten. Integrasi ke app saya cuma butuh 30 menit. Support juga fast response via WhatsApp.",
    },
  ];

  const faqs = [
    {
      q: t("landing.faq1Q"),
      a: t("landing.faq1A"),
    },
    {
      q: t("landing.faq2Q"),
      a: t("landing.faq2A"),
    },
    {
      q: t("landing.faq3Q"),
      a: t("landing.faq3A"),
    },
    {
      q: t("landing.faq4Q"),
      a: t("landing.faq4A"),
    },
    {
      q: t("landing.faq5Q"),
      a: t("landing.faq5A"),
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="primary" className="mb-6">
              {t("landing.badge")}
            </Badge>

            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold font-[family-name:var(--font-space-grotesk)] leading-tight mb-6">
              {t("landing.heroTitle")}{" "}
              <span className="gradient-text">{t("landing.heroTitleHighlight")}</span>
            </h1>

            <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
              {t("landing.heroDesc")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)] px-8 py-3 text-base">
                  {t("landing.startNow")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#fitur" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-surface text-foreground border border-border hover:bg-surface-hover px-8 py-3 text-base">
                  {t("landing.viewFeatures")}
              </Link>
            </div>

            {/* Animated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {statsAnimated.map((stat) => (
                <Card key={stat.label} className="text-center py-4">
                  <CardContent>
                    <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                    <div ref={stat.ref} className="text-lg sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                      {stat.value}{stat.suffix}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">{t("nav.features")}</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              {t("landing.featuresTitle")} <span className="text-primary">KirimKode</span>?
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              {t("landing.featuresDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="hover:border-primary/30 transition-all duration-300 group"
              >
                <CardContent>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview — Now with SVG Logos */}
      <section id="layanan" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">{t("landing.servicesBadge")}</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              {t("landing.servicesTitle")}
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {[
              "WhatsApp", "Telegram", "Facebook", "Instagram", "TikTok", "Twitter/X",
              "Google", "Discord", "Shopee", "Tokopedia", "Grab", "DANA",
            ].map((name) => (
              <Card key={name} className="text-center py-4 hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent>
                  <div className="flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    {serviceIcons[name] || <span className="text-2xl font-bold text-primary">{name[0]}</span>}
                  </div>
                  <div className="text-xs text-muted">{name}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-surface text-foreground border border-border hover:bg-surface-hover px-4 py-2 text-sm">
                {t("landing.viewAllServices")} <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cara Kerja Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">{t("landing.howItWorksBadge")}</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              {t("landing.howItWorksTitle")} <span className="text-primary">{t("landing.howItWorksHighlight")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto">
            {howItWorks.map((item, i) => (
              <Card key={item.step} className="relative text-center group hover:border-primary/30 transition-all">
                <CardContent>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-xs text-primary font-bold mb-2">{t("landing.step")} {item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted">{item.description}</p>
                </CardContent>
                {i < howItWorks.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/40" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Per OTP */}
      <section id="harga" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">{t("nav.pricing")}</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              {t("landing.pricingTitle")} <span className="text-primary">{t("landing.pricingHighlight")}</span>
            </h2>
            <p className="text-muted">
              {t("landing.pricingDesc")}{" "}
              <span className="text-primary font-semibold">Rp 1.200</span> {t("landing.pricingPerNumber")}
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
            <Card className="text-center">
              <CardContent>
                <Wallet className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">{t("landing.minDeposit")}</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">Rp 5.000</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <CreditCard className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">{t("landing.payment")}</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">QRIS</div>
                <div className="text-xs text-muted">{t("landing.allEwalletBank")}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">{t("landing.autoRefund")}</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">20 Min</div>
                <div className="text-xs text-muted">{t("landing.ifNoOtp")}</div>
              </CardContent>
            </Card>
          </div>

          {/* Price Table */}
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">{t("landing.service")}</th>
                      <th className="pb-3 font-medium">{t("landing.country")}</th>
                      <th className="pb-3 font-medium">{t("landing.pricePerOtp")}</th>
                      <th className="pb-3 font-medium">{t("landing.stock")}</th>
                      <th className="pb-3 font-medium"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {otpPrices.map((item, i) => (
                      <tr key={`${item.service}-${item.country}-${i}`} className="border-b border-border/50 hover:bg-background/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.service}</span>
                            {item.popular && <Badge variant="primary">{t("landing.popular")}</Badge>}
                          </div>
                        </td>
                        <td className="py-3 text-muted">{item.country}</td>
                        <td className="py-3">
                          <span className="font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                            Rp {item.price.toLocaleString("id-ID")}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${item.available > 200 ? "bg-success" : item.available > 50 ? "bg-accent" : "bg-error"}`} />
                            <span className="text-muted">{item.available}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Link href="/register" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)] px-4 py-1.5 text-xs">
                            {t("landing.buy")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-center mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted mb-3">
                  {t("landing.priceDisclaimer")}
                </p>
                <Link href="/register" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-surface text-foreground border border-border hover:bg-surface-hover px-4 py-2 text-sm">
                    {t("landing.viewAllPrices")} <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Testimoni</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Dipercaya <span className="text-primary">Ribuan Pengguna</span>
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Lihat apa kata mereka tentang pengalaman menggunakan KirimKode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {testimonials.map((testi) => (
              <Card key={testi.name} className="hover:border-primary/30 transition-all duration-300">
                <CardContent>
                  <Quote className="w-8 h-8 text-primary/20 mb-3" />
                  <p className="text-sm text-muted mb-4 leading-relaxed">{testi.text}</p>
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < testi.stars ? "text-yellow-400 fill-yellow-400" : "text-border"}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {testi.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{testi.name}</div>
                      <div className="text-xs text-muted">{testi.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">{t("nav.faq")}</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              {t("landing.faqTitle")}
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.q}>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <ChevronDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold mb-2">{faq.q}</h3>
                      <p className="text-sm text-muted">{faq.a}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            {t("landing.ctaTitle")} <span className="gradient-text">{t("landing.ctaTitleHighlight")}</span>?
          </h2>
          <p className="text-lg text-muted mb-8">
            {t("landing.ctaDesc")}
          </p>
          <Link href="/register" className="inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)] px-8 py-3 text-base animate-pulse-glow">
              {t("landing.ctaButton")} <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      </section>
    </>
  );
}
