"use client";

import { Zap } from "lucide-react";
import { useLanguageStore } from "@/store/language";

export function Footer() {
  const { t } = useLanguageStore();

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
                Kirim<span className="text-primary">Kode</span>
              </span>
            </div>
            <p className="text-sm text-muted">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.services")}</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="/nomor-virtual-whatsapp" className="hover:text-foreground transition-colors">WhatsApp OTP</a></li>
              <li><a href="/nomor-virtual-telegram" className="hover:text-foreground transition-colors">Telegram OTP</a></li>
              <li><a href="/nomor-virtual-shopee-tokopedia" className="hover:text-foreground transition-colors">Shopee & Tokopedia</a></li>
              <li><a href="/nomor-virtual-kreator-sosmed" className="hover:text-foreground transition-colors">Kreator Sosmed</a></li>
              <li><a href="/nomor-virtual-qa-testing" className="hover:text-foreground transition-colors">QA Testing</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.company")}</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="/about" className="hover:text-foreground transition-colors">{t("footer.aboutUs")}</a></li>
              <li><a href="/api-docs" className="hover:text-foreground transition-colors">API Docs</a></li>
              <li><a href="/contact" className="hover:text-foreground transition-colors">{t("footer.contact")}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.legal")}</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="/terms" className="hover:text-foreground transition-colors">{t("footer.terms")}</a></li>
              <li><a href="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a></li>
              <li><a href="/refund" className="hover:text-foreground transition-colors">{t("footer.refund")}</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted">
            {t("footer.copyright")}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span>{t("footer.countries")}</span>
            <span className="text-border">|</span>
            <span>{t("footer.servicesCount")}</span>
            <span className="text-border">|</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
