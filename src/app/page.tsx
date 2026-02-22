"use client";

import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useLanguageStore } from "@/store/language";

export default function HomePage() {
  const { t } = useLanguageStore();

  const stats = [
    { label: t("landing.statsCountries"), value: "200+", icon: Globe },
    { label: t("landing.statsServices"), value: "500+", icon: MessageSquare },
    { label: t("landing.statsUsers"), value: "10K+", icon: Users },
    { label: t("landing.statsOtp"), value: "1M+", icon: Send },
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
    <div className="min-h-screen bg-background">
      <Navbar />

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
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  {t("landing.startNow")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="#fitur">
                <Button variant="secondary" size="lg">
                  {t("landing.viewFeatures")}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="text-center py-4">
                  <CardContent>
                    <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                      {stat.value}
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

      {/* Services Preview */}
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
              { name: "WhatsApp", color: "text-green-400" },
              { name: "Telegram", color: "text-blue-400" },
              { name: "Facebook", color: "text-blue-500" },
              { name: "Instagram", color: "text-pink-400" },
              { name: "TikTok", color: "text-foreground" },
              { name: "Twitter/X", color: "text-foreground" },
              { name: "Google", color: "text-red-400" },
              { name: "Discord", color: "text-indigo-400" },
              { name: "Shopee", color: "text-orange-400" },
              { name: "Tokopedia", color: "text-green-500" },
              { name: "Grab", color: "text-green-400" },
              { name: "DANA", color: "text-blue-400" },
            ].map((service) => (
              <Card key={service.name} className="text-center py-4 hover:border-primary/30 transition-all cursor-pointer">
                <CardContent>
                  <div className={`text-2xl mb-2 ${service.color} font-bold`}>
                    {service.name[0]}
                  </div>
                  <div className="text-xs text-muted">{service.name}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/register">
              <Button variant="secondary">
                {t("landing.viewAllServices")} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
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
                      <th className="pb-3 font-medium"></th>
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
                          <Link href="/register">
                            <Button size="sm" className="text-xs">{t("landing.buy")}</Button>
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
                <Link href="/register">
                  <Button variant="secondary">
                    {t("landing.viewAllPrices")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
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

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            {t("landing.ctaTitle")} <span className="gradient-text">{t("landing.ctaTitleHighlight")}</span>?
          </h2>
          <p className="text-lg text-muted mb-8">
            {t("landing.ctaDesc")}
          </p>
          <Link href="/register">
            <Button size="lg" className="animate-pulse-glow">
              {t("landing.ctaButton")} <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
