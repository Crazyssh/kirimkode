"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import {
  Users,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Loader2,
  Package,
  BarChart3,
  Activity,
} from "lucide-react";

interface StatsData {
  totalUsers: number;
  activeUsersWeek: number;
  ordersToday: number;
  depositsToday: number;
  totalRevenue: number;
  ordersPerDay: { date: string; count: number }[];
  topServices: { name: string; count: number }[];
  recentOrders: {
    id: string;
    userEmail: string;
    service: string;
    status: string;
    price: number;
    time: string;
  }[];
  recentDeposits: {
    id: string;
    userEmail: string;
    amount: number;
    status: string;
    channel: string;
    time: string;
  }[];
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      label: "Total Users",
      value: String(data?.totalUsers ?? 0),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Orders Hari Ini",
      value: String(data?.ordersToday ?? 0),
      icon: ShoppingCart,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Deposit Masuk",
      value: formatRupiah(data?.depositsToday ?? 0),
      icon: Wallet,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Total Revenue",
      value: formatRupiah(data?.totalRevenue ?? 0),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "User Aktif (7 hari)",
      value: String(data?.activeUsersWeek ?? 0),
      icon: Activity,
      color: "text-accent",
      bg: "bg-accent/10",
    },
  ];

  const ordersPerDay = data?.ordersPerDay || [];
  const maxOrders = Math.max(...ordersPerDay.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Admin Overview
        </h1>
        <p className="text-sm text-muted">
          Ringkasan data platform KirimKode
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">
                {stat.value}
              </div>
              <div className="text-xs text-muted">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Services */}
      {data?.topServices && data.topServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Top Layanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topServices.map((service, index) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-3 rounded-xl bg-background/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary font-[family-name:var(--font-jetbrains-mono)]">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  <Badge variant="primary">
                    <span className="font-[family-name:var(--font-jetbrains-mono)]">
                      {service.count}
                    </span>
                    &nbsp;order
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Per Day Chart */}
      {ordersPerDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Order 7 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {ordersPerDay.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">
                    {day.count}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-primary/80 transition-all duration-500 min-h-[4px]"
                    style={{ height: `${(day.count / maxOrders) * 100}%` }}
                  />
                  <span className="text-[9px] text-muted">
                    {new Date(day.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders + Recent Deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-accent" />
              Order Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentOrders && data.recentOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Layanan</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Harga</th>
                      <th className="pb-3 font-medium">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 text-xs text-muted max-w-[120px] truncate">
                          {order.userEmail}
                        </td>
                        <td className="py-3 font-medium text-xs">
                          {order.service}
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
                              ? "Berhasil"
                              : order.status === "waiting"
                              ? "Menunggu"
                              : "Dibatalkan"}
                          </Badge>
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(order.price)}
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {formatDate(order.time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Belum ada order</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deposits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-success" />
              Deposit Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentDeposits && data.recentDeposits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Jumlah</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.recentDeposits.map((deposit) => (
                      <tr
                        key={deposit.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 text-xs text-muted max-w-[120px] truncate">
                          {deposit.userEmail}
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium text-primary">
                          {formatRupiah(deposit.amount)}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              deposit.status === "paid"
                                ? "success"
                                : deposit.status === "pending"
                                ? "warning"
                                : "error"
                            }
                          >
                            {deposit.status === "paid"
                              ? "Lunas"
                              : deposit.status === "pending"
                              ? "Pending"
                              : "Expired"}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {formatDate(deposit.time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted">
                <Wallet className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Belum ada deposit</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
