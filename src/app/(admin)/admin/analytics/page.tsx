"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import {
  TrendingUp,
  Loader2,
  BarChart3,
  Users,
  ShoppingCart,
  Wallet,
  Target,
  DollarSign,
} from "lucide-react";

interface DayAmount { date: string; amount: number }
interface DayCount { date: string; count: number }
interface TopService { name: string; count: number; revenue: number }
interface TopUser { email: string; name: string; orders: number; spent: number }

interface AnalyticsData {
  period: number;
  summary: {
    totalRevenue: number;
    totalDeposits: number;
    totalOrders: number;
    successOrders: number;
    successRate: number;
    avgOrderValue: number;
  };
  revenuePerDay: DayAmount[];
  depositsPerDay: DayAmount[];
  newUsersPerDay: DayCount[];
  ordersPerDay: DayCount[];
  topServices: TopService[];
  topUsers: TopUser[];
}

const PERIODS = [
  { label: "7 Hari", value: 7 },
  { label: "30 Hari", value: 30 },
  { label: "90 Hari", value: 90 },
];

function BarChart({ data, type, color }: { data: { label: string; value: number }[]; type: "amount" | "count"; color: string }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  // Show max ~30 bars, skip labels if too many
  const showEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1;

  return (
    <div className="flex items-end gap-[2px] h-44 overflow-x-auto">
      {data.map((d, i) => (
        <div key={d.label} className="flex-1 min-w-[6px] flex flex-col items-center gap-0.5 group relative">
          <div className="hidden group-hover:block absolute -top-8 bg-surface border border-border rounded-lg px-2 py-1 text-[10px] font-[family-name:var(--font-jetbrains-mono)] whitespace-nowrap z-10 shadow-lg">
            {type === "amount" ? formatRupiah(d.value) : d.value} — {d.label}
          </div>
          <div
            className={`w-full rounded-t-sm ${color} transition-all duration-300 min-h-[2px]`}
            style={{ height: `${(d.value / maxVal) * 100}%` }}
          />
          {i % showEvery === 0 && (
            <span className="text-[8px] text-muted whitespace-nowrap">
              {new Date(d.label).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const summaryCards = [
    { label: "Total Revenue", value: formatRupiah(data.summary.totalRevenue), icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Deposit", value: formatRupiah(data.summary.totalDeposits), icon: Wallet, color: "text-success", bg: "bg-success/10" },
    { label: "Total Orders", value: String(data.summary.totalOrders), icon: ShoppingCart, color: "text-accent", bg: "bg-accent/10" },
    { label: "Success Rate", value: `${data.summary.successRate}%`, icon: Target, color: "text-success", bg: "bg-success/10" },
    { label: "Avg Order", value: formatRupiah(data.summary.avgOrderValue), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Analytics
          </h1>
          <p className="text-sm text-muted">Revenue, deposit, dan pertumbuhan user</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                period === p.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/30 text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {summaryCards.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">
                {s.value}
              </div>
              <div className="text-xs text-muted">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" />
            Revenue per Hari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={data.revenuePerDay.map((d) => ({ label: d.date, value: d.amount }))}
            type="amount"
            color="bg-primary/80"
          />
        </CardContent>
      </Card>

      {/* Deposit + Orders Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-4 h-4 text-success" />
              Deposit per Hari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.depositsPerDay.map((d) => ({ label: d.date, value: d.amount }))}
              type="amount"
              color="bg-success/80"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="w-4 h-4 text-accent" />
              Order per Hari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.ordersPerDay.map((d) => ({ label: d.date, value: d.count }))}
              type="count"
              color="bg-accent/80"
            />
          </CardContent>
        </Card>
      </div>

      {/* User Growth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            User Baru per Hari
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={data.newUsersPerDay.map((d) => ({ label: d.date, value: d.count }))}
            type="count"
            color="bg-blue-500/80"
          />
        </CardContent>
      </Card>

      {/* Top Services + Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Top Layanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topServices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Layanan</th>
                      <th className="pb-2 font-medium">Orders</th>
                      <th className="pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.topServices.map((s, i) => (
                      <tr key={s.name} className="border-b border-border/50">
                        <td className="py-2 text-muted text-xs">{i + 1}</td>
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2">
                          <Badge variant="primary">
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">{s.count}</span>
                          </Badge>
                        </td>
                        <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(s.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted text-sm">Tidak ada data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Top Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Orders</th>
                      <th className="pb-2 font-medium">Spent</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.topUsers.map((u, i) => (
                      <tr key={u.email} className="border-b border-border/50">
                        <td className="py-2 text-muted text-xs">{i + 1}</td>
                        <td className="py-2 text-xs max-w-[150px] truncate">{u.email}</td>
                        <td className="py-2">
                          <Badge variant="primary">
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">{u.orders}</span>
                          </Badge>
                        </td>
                        <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(u.spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted text-sm">Tidak ada data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
