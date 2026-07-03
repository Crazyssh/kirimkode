"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Zap,
  LayoutDashboard,
  Users,
  ShoppingCart,
  Wallet,
  DollarSign,
  Megaphone,
  ScrollText,
  Ticket,
  FileText,
  ArrowLeft,
  LogOut,
  X,
  SearchCheck,
  BarChart3,
  Server,
  Settings,
  Package,
  Eye,
  Scale,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/deposits", label: "Deposits", icon: Wallet },
  { href: "/admin/pricing", label: "Harga OTP", icon: DollarSign },
  { href: "/admin/cancel-rules", label: "Waktu Cancel", icon: Timer },
  { href: "/admin/api4-stock", label: "Neptune Stock", icon: Package },
  { href: "/admin/server-visibility", label: "Server Visibility", icon: Eye },
  { href: "/admin/vouchers", label: "Voucher", icon: Ticket },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/broadcast", label: "Broadcast", icon: Megaphone },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/reconcile", label: "Rekonsiliasi Saldo", icon: Scale },
  { href: "/admin/checker", label: "Checker", icon: SearchCheck },
  { href: "/admin/server", label: "Server", icon: Server },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

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
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
              Kirim<span className="text-primary">Kode</span>
            </span>
            <Badge variant="primary">Admin</Badge>
          </Link>
          <button onClick={onClose} className="lg:hidden text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
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
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            User Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-error hover:bg-error/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
