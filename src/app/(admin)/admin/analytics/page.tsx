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
  Server,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DayAmount { date: string; amount: number }
interface DayCount { date: string; count: number }
interface TopService { name: string; count: number; revenue: number }
interface TopUser { email: string; name: string; orders: number; spent: number }

interface AnalyticsData {
  period: number;
  periodLabel: string;
  startDate: string;
  endDate: string;
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
  perServer: PerServer[];
}

interface PerServer {
  server: string;
  successOrders: number;
  revenue: number;
}

const SERVER_LABELS: Record<string, { name: string; icon: string }> = {
  api1: { name: "Mars", icon: "🔴" },
  api2: { name: "Jupiter", icon: "🟠" },
  api3: { name: "Saturn", icon: "🟣" },
  api4: { name: "Neptune", icon: "🔵" },
  api5: { name: "Earth (Beta)", icon: "🌍" },
  api6: { name: "Venus (Beta)", icon: "🪐" },
  api7: { name: "Mars V2", icon: "🔴" },
  api8: { name: "Mercury", icon: "☿️" },
  api9: { name: "Uranus", icon: "🌌" },
  api10: { name: "Eris", icon: "✨" },
  bot: { name: "Bot", icon: "🤖" },
  unified: { name: "Bimasakti", icon: "⚡" },
};

const PERIODS = [
  { label: "1 Hari", value: "1d" },
  { label: "3 Hari", value: "3d" },
  { label: "7 Hari", value: "7d" },
  { label: "Bulan Ini", value: "this_month" },
  { label: "Bulan Lalu", value: "last_month" },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
/* ───── Custom Tooltip ───── */
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const dateStr = label
    ? new Date(label).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  return (
    <div className="bg-surface/95 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-xl">
      <p className="text-[11px] text-muted mb-1">{dateStr}</p>
      <p className="text-sm font-bold font-[family-name:var(--font-jetbrains-mono)]">
        {formatter(payload[0].value)}
      </p>
    </div>
  );
}

/* ───── Reusable Area Chart ───── */
function AnalyticsAreaChart({
  data,
  dataKey,
  color,
  gradientId,
  formatter,
}: {
  data: { date: string; value: number }[];
  dataKey: string;
  color: string;
  gradientId: string;
  formatter: (v: number) => string;
}) {
  const showEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 6"
          stroke="currentColor"
          className="text-border"
          opacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "var(--color-muted, #6b7280)" }}
          interval={showEvery - 1}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "2-digit",
            })
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: "var(--color-muted, #6b7280)" }}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}K`
              : String(v)
          }
          width={48}
        />
        <Tooltip
          content={(props: any) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              formatter={formatter}
            />
          )}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 5,
            fill: color,
            stroke: "var(--color-surface, #1a1a2e)",
            strokeWidth: 2,
          }}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("7d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
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

  const fmtRupiah = (v: number) => formatRupiah(v);
  const fmtCount = (v: number) => String(v);

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
          <AnalyticsAreaChart
            data={data.revenuePerDay.map((d) => ({ date: d.date, value: d.amount }))}
            dataKey="value"
            color="#22d3ee"
            gradientId="gradRevenue"
            formatter={fmtRupiah}
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
            <AnalyticsAreaChart
              data={data.depositsPerDay.map((d) => ({ date: d.date, value: d.amount }))}
              dataKey="value"
              color="#34d399"
              gradientId="gradDeposit"
              formatter={fmtRupiah}
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
            <AnalyticsAreaChart
              data={data.ordersPerDay.map((d) => ({ date: d.date, value: d.count }))}
              dataKey="value"
              color="#fbbf24"
              gradientId="gradOrders"
              formatter={fmtCount}
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
          <AnalyticsAreaChart
            data={data.newUsersPerDay.map((d) => ({ date: d.date, value: d.count }))}
            dataKey="value"
            color="#818cf8"
            gradientId="gradUsers"
            formatter={fmtCount}
          />
        </CardContent>
      </Card>

      {/* Per-Server Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Pendapatan & Order per Server
            <span className="text-xs text-muted font-normal ml-1">(success only)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.perServer.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Server</th>
                    <th className="pb-2 font-medium">Order Sukses</th>
                    <th className="pb-2 font-medium">Pendapatan</th>
                    <th className="pb-2 font-medium">Avg / Order</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.perServer.map((s) => {
                    const meta = SERVER_LABELS[s.server] || { name: s.server, icon: "⚪" };
                    const avg = s.successOrders > 0 ? Math.round(s.revenue / s.successOrders) : 0;
                    return (
                      <tr key={s.server} className="border-b border-border/50">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{meta.icon}</span>
                            <span className="font-medium">{meta.name}</span>
                            <code className="text-[10px] text-muted/70 font-[family-name:var(--font-jetbrains-mono)]">
                              {s.server}
                            </code>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge variant="primary">
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">
                              {s.successOrders}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 font-bold font-[family-name:var(--font-jetbrains-mono)] text-success">
                          {formatRupiah(s.revenue)}
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted">
                          {formatRupiah(avg)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted text-sm">Tidak ada order sukses di periode ini</p>
          )}
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
