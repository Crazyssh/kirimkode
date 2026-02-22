"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/language";
import {
  Zap,
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Code,
  Settings,
  LogOut,
  X,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguageStore();

  const menuItems = [
    { href: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
    { href: "/buy", label: t("sidebar.buyNumber"), icon: ShoppingCart },
    { href: "/deposit", label: t("sidebar.deposit"), icon: Wallet },
    { href: "/api-docs", label: t("sidebar.apiDocs"), icon: Code },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-surface border-r border-border z-50 flex flex-col transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
              Kirim<span className="text-primary">Kode</span>
            </span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border space-y-1">
          <Link
            href="/settings"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
              pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            )}
          >
            <Settings className="w-5 h-5" />
            {t("sidebar.settings")}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-error hover:bg-error/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            {t("common.logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
