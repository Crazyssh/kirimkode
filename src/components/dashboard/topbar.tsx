"use client";

import { useEffect, useState } from "react";
import { Menu, Bell, Wallet, Moon, Sun } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { useUserStore } from "@/store/user";
import { LanguageSwitcher } from "@/components/language-switcher";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { user, loading, fetchUser } = useUserStore();
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    fetchUser();
    // Auto-refresh balance setiap 30 detik
    const interval = setInterval(() => fetchUser(), 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const displayName = user?.name || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 glass border-b border-border flex items-center justify-between px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-muted hover:text-foreground"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 border border-primary/20">
          <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          <span className="text-xs sm:text-sm font-semibold font-[family-name:var(--font-jetbrains-mono)] text-primary">
            {loading ? "..." : formatRupiah(user?.balance ?? 0)}
          </span>
        </div>

        <LanguageSwitcher />

        <button
          onClick={toggleTheme}
          className="p-2 text-muted hover:text-foreground transition-colors"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button className="relative p-2 text-muted hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          {user?.image ? (
            <img
              src={user.image}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {initial}
            </div>
          )}
          <div className="hidden sm:block">
            <div className="text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
