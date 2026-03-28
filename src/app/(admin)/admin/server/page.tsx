"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Loader2,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Terminal,
  Activity,
  RefreshCw,
  Box,
} from "lucide-react";

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  kernel: string;
  uptime: string;
  uptimeSeconds: number;
}

interface CpuInfo {
  model: string;
  cores: number;
  speed: string;
  loadAvg: { "1m": string; "5m": string; "15m": string };
  loadPercent: number;
}

interface RamInfo {
  total: string;
  used: string;
  free: string;
  percent: number;
}

interface DiskInfo {
  total: string;
  used: string;
  free: string;
  percent: number;
}

interface Pm2Process {
  name: string;
  pid: number;
  status: string;
  cpu: number;
  memory: string;
  uptime: string;
  restarts: number;
}

interface CronJob {
  schedule: string;
  command: string;
}

interface NodeInfo {
  version: string;
  memoryUsage: string;
  memoryTotal: string;
}

interface ServerData {
  system: SystemInfo;
  cpu: CpuInfo;
  ram: RamInfo;
  disk: DiskInfo;
  pm2: Pm2Process[];
  cron: CronJob[];
  node: NodeInfo;
}

interface HistoryPoint {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
}

const MAX_HISTORY = 30; // 30 data points = 5 minutes at 10s interval

function UsageBar({
  percent,
  color = "bg-primary",
}: {
  percent: number;
  color?: string;
}) {
  const barColor =
    percent >= 90 ? "bg-error" : percent >= 70 ? "bg-warning" : color;
  return (
    <div className="w-full h-3 bg-background/60 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function UsageRing({
  percent,
  size = 100,
  strokeWidth = 8,
  color,
  label,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)]">
          {percent}%
        </span>
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs border border-border shadow-lg">
      <p className="text-muted mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-[family-name:var(--font-jetbrains-mono)]">
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
}

export default function AdminServerPage() {
  const [data, setData] = useState<ServerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const historyRef = useRef<HistoryPoint[]>([]);

  const fetchServerInfo = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/server-info");
      if (res.ok) {
        const json = await res.json();
        const serverData: ServerData = json.data;
        setData(serverData);
        setLastUpdate(new Date());

        // Append to history
        const now = new Date();
        const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const newPoint: HistoryPoint = {
          time: timeStr,
          cpu: serverData.cpu.loadPercent,
          ram: serverData.ram.percent,
          disk: serverData.disk.percent,
        };
        const updated = [...historyRef.current, newPoint].slice(-MAX_HISTORY);
        historyRef.current = updated;
        setHistory(updated);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServerInfo();
    const interval = setInterval(() => fetchServerInfo(), 10000);
    return () => clearInterval(interval);
  }, [fetchServerInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <p>Gagal memuat informasi server</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Server Monitor
          </h1>
          <p className="text-sm text-muted">
            Monitoring real-time server KirimKode
            <span className="inline-flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-success text-xs">Live</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted hidden sm:block font-[family-name:var(--font-jetbrains-mono)]">
              {lastUpdate.toLocaleTimeString("id-ID")}
            </span>
          )}
          <button
            onClick={() => fetchServerInfo(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Usage Rings Overview */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center relative">
              <UsageRing percent={data.cpu.loadPercent} color="var(--color-accent)" label="CPU Load" />
            </div>
            <div className="flex flex-col items-center relative">
              <UsageRing percent={data.ram.percent} color="var(--color-primary)" label="RAM Usage" />
            </div>
            <div className="flex flex-col items-center relative">
              <UsageRing percent={data.disk.percent} color="var(--color-success)" label="Disk Usage" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="w-4 h-4 text-accent" />
              CPU Load History
              <span className="text-xs text-muted font-normal ml-auto">10s interval</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU"
                    stroke="var(--color-accent)"
                    fill="url(#cpuGradient)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* RAM History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="w-4 h-4 text-primary" />
              RAM Usage History
              <span className="text-xs text-muted font-normal ml-auto">10s interval</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="ram"
                    name="RAM"
                    stroke="var(--color-primary)"
                    fill="url(#ramGradient)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Info + Node */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-4 h-4 text-primary" />
              System Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Hostname", value: data.system.hostname },
                { label: "OS", value: `${data.system.platform} (${data.system.arch})` },
                { label: "Kernel", value: data.system.kernel },
                { label: "Uptime", value: data.system.uptime },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted">{item.label}</span>
                  <span className="text-sm font-medium font-[family-name:var(--font-jetbrains-mono)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Box className="w-4 h-4 text-accent" />
              Node.js Runtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Version", value: data.node.version },
                { label: "Heap Used", value: data.node.memoryUsage },
                { label: "Heap Total", value: data.node.memoryTotal },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm text-muted">{item.label}</span>
                  <span className="text-sm font-medium font-[family-name:var(--font-jetbrains-mono)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CPU + RAM + Disk Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CPU */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="w-4 h-4 text-accent" />
              CPU Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <UsageBar percent={data.cpu.loadPercent} color="bg-accent" />
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted">
                  <span>{data.cpu.cores} Cores</span>
                  <span>{data.cpu.speed}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Load 1m/5m/15m</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">
                    {data.cpu.loadAvg["1m"]} / {data.cpu.loadAvg["5m"]} / {data.cpu.loadAvg["15m"]}
                  </span>
                </div>
                <p className="text-[10px] text-muted/60 truncate" title={data.cpu.model}>
                  {data.cpu.model}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RAM */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="w-4 h-4 text-primary" />
              RAM Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <UsageBar percent={data.ram.percent} />
              <div className="text-xs text-muted space-y-1">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.ram.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.ram.used}</span>
                </div>
                <div className="flex justify-between">
                  <span>Free</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.ram.free}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="w-4 h-4 text-success" />
              Disk Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <UsageBar percent={data.disk.percent} color="bg-success" />
              <div className="text-xs text-muted space-y-1">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.disk.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.disk.used}</span>
                </div>
                <div className="flex justify-between">
                  <span>Free</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">{data.disk.free}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PM2 Processes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            PM2 Processes
            {data.pm2.length > 0 && (
              <Badge variant="primary">{data.pm2.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.pm2.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">PID</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">CPU</th>
                    <th className="pb-3 font-medium">Memory</th>
                    <th className="pb-3 font-medium">Uptime</th>
                    <th className="pb-3 font-medium">Restarts</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.pm2.map((proc, i) => (
                    <tr
                      key={`${proc.name}-${i}`}
                      className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                    >
                      <td className="py-3 font-medium font-[family-name:var(--font-jetbrains-mono)] text-xs">
                        {proc.name}
                      </td>
                      <td className="py-3 text-xs text-muted font-[family-name:var(--font-jetbrains-mono)]">
                        {proc.pid}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            proc.status === "online"
                              ? "success"
                              : proc.status === "stopped"
                              ? "warning"
                              : "error"
                          }
                        >
                          {proc.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs font-[family-name:var(--font-jetbrains-mono)]">
                        {proc.cpu}%
                      </td>
                      <td className="py-3 text-xs font-[family-name:var(--font-jetbrains-mono)]">
                        {proc.memory}
                      </td>
                      <td className="py-3 text-xs text-muted">
                        {proc.uptime}
                      </td>
                      <td className="py-3 text-xs font-[family-name:var(--font-jetbrains-mono)]">
                        {proc.restarts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Tidak ada PM2 process yang terdeteksi</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-accent" />
            Cron Jobs
            {data.cron.length > 0 && (
              <Badge variant="primary">{data.cron.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.cron.length > 0 ? (
            <div className="space-y-2">
              {data.cron.map((job, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-background/50 border border-border/30"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent shrink-0" />
                    <code className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-primary bg-primary/10 px-2 py-1 rounded-lg whitespace-nowrap">
                      {job.schedule}
                    </code>
                  </div>
                  <code className="text-xs font-[family-name:var(--font-jetbrains-mono)] text-muted break-all">
                    {job.command}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Tidak ada cron job yang terdeteksi</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
