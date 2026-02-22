"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
import Link from "next/link";
import {
  Wallet,
  ShoppingCart,
  CheckCircle,
  XCircle,
  ArrowRight,
  Copy,
  Loader2,
  TrendingUp,
  Star,
} from "lucide-react";

interface RecentOrder {
  id: string;
  service: string;
  country: string;
  number: string;
  code: string | null;
  status: string;
  price: number;
  time: string;
}

interface DashboardData {
  balance: number;
  stats: {
    totalOrders: number;
    successOrders: number;
    failedOrders: number;
    todayCount: number;
    successRate: number;
    monthlySpent: number;
    topService: string | null;
    topServiceCount: number;
  };
  recentOrders: RecentOrder[];
}

export default function DashboardPage() {
  const { user, updateBalance } = useUserStore();
  const { t, locale } = useLanguageStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          // Sync balance to store so topbar updates
          if (json.data?.balance !== undefined) {
            updateBalance(json.data.balance);
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("dashboard.justNow");
    if (diffMins < 60) return t("dashboard.minutesAgo", { n: diffMins });
    if (diffHours < 24) return t("dashboard.hoursAgo", { n: diffHours });
    if (diffDays < 7) return t("dashboard.daysAgo", { n: diffDays });
    return date.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    {
      label: t("dashboard.balance"),
      value: formatRupiah(data?.balance ?? user?.balance ?? 0),
      icon: Wallet,
      change: t("dashboard.activeBalance"),
      trend: "up" as const,
    },
    {
      label: t("dashboard.totalOrders"),
      value: String(data?.stats.totalOrders ?? 0),
      icon: ShoppingCart,
      change: `${data?.stats.todayCount ?? 0} ${t("dashboard.today")}`,
      trend: "up" as const,
    },
    {
      label: t("dashboard.successOrders"),
      value: String(data?.stats.successOrders ?? 0),
      icon: CheckCircle,
      change: `${data?.stats.successRate ?? 0}% ${t("dashboard.successRate")}`,
      trend: "up" as const,
    },
    {
      label: t("dashboard.failedOrders"),
      value: String(data?.stats.failedOrders ?? 0),
      icon: XCircle,
      change: t("dashboard.autoRefund"),
      trend: "down" as const,
    },
    {
      label: t("dashboard.monthlySpent"),
      value: formatRupiah(data?.stats.monthlySpent ?? 0),
      icon: TrendingUp,
      change: new Date().toLocaleString("id-ID", { month: "long" }),
      trend: "up" as const,
    },
    {
      label: t("dashboard.favoriteService"),
      value: data?.stats.topService ?? "-",
      icon: Star,
      change: data?.stats.topServiceCount ? `${data.stats.topServiceCount}x order` : t("dashboard.notYet"),
      trend: "up" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-muted">
            {t("dashboard.welcome")} {user?.name || "User"}!
          </p>
        </div>
        <Link href="/buy">
          <Button>
            <ShoppingCart className="w-4 h-4" />
            {t("dashboard.buyNumber")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <Badge variant={stat.trend === "up" ? "success" : "error"} className="text-[9px] sm:text-xs">
                  {stat.change}
                </Badge>
              </div>
              <div className="text-lg sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)] truncate">
                {stat.value}
              </div>
              <div className="text-[10px] sm:text-xs text-muted">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
            <Link href="/history">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] sm:text-xs text-muted border-b border-border">
                  <th className="pb-3 font-medium">{t("dashboard.service")}</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">{t("dashboard.number")}</th>
                  <th className="pb-3 font-medium">{t("dashboard.otp")}</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium hidden md:table-cell">{t("dashboard.price")}</th>
                  <th className="pb-3 font-medium hidden md:table-cell">{t("dashboard.time")}</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm">
                {data?.recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border/50">
                    <td className="py-2 sm:py-3">
                      <span className="font-medium">{order.service}</span>
                    </td>
                    <td className="py-2 sm:py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs hidden sm:table-cell">
                      {order.number}
                    </td>
                    <td className="py-3">
                      {order.code ? (
                        <div className="flex items-center gap-2">
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">
                            {order.code}
                          </span>
                          <button
                            className="text-muted hover:text-foreground"
                            onClick={() => navigator.clipboard.writeText(order.code!)}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={
                          order.status === "success"
                            ? "success"
                            : order.status === "waiting"
                            ? "warning"
                            : "error"
                        }
                      >
                        {order.status === "success"
                          ? t("status.order.success")
                          : order.status === "waiting"
                          ? t("status.order.waiting")
                          : order.status === "cancelled"
                          ? t("status.order.cancelled")
                          : t("status.order.timeout")}
                      </Badge>
                    </td>
                    <td className="py-2 sm:py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs hidden md:table-cell">
                      {formatRupiah(order.price)}
                    </td>
                    <td className="py-2 sm:py-3 text-xs text-muted hidden md:table-cell">
                      {formatRelativeTime(order.time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!data?.recentOrders || data.recentOrders.length === 0) && (
            <div className="text-center py-12 text-muted">
              <ShoppingCart className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>{t("dashboard.noTransactions")}</p>
              <p className="text-xs mt-1">{t("dashboard.startBuying")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
