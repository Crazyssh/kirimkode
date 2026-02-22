"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguageStore } from "@/store/language";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguageStore();

  const navLinks = [
    { href: "#fitur", label: t("nav.features") },
    { href: "#layanan", label: t("nav.services") },
    { href: "#harga", label: t("nav.pricing") },
    { href: "#faq", label: t("nav.faq") },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
            Kirim<span className="text-primary">Kode</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/login">
            <Button variant="ghost" size="sm">{t("common.login")}</Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">{t("common.register")}</Button>
          </Link>
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden glass border-t border-border">
          <div className="px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted hover:text-foreground py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <LanguageSwitcher />
              <div className="flex gap-3">
                <Link href="/login">
                  <Button variant="secondary" size="sm">{t("common.login")}</Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">{t("common.register")}</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
