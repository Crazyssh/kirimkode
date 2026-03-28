import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import os from "os";
import { execSync } from "child_process";

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return "";
  }
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(" ");
}

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    // --- OS Info ---
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      kernel: os.release(),
      uptime: formatUptime(os.uptime()),
      uptimeSeconds: os.uptime(),
    };

    // --- CPU Info ---
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuInfo = {
      model: cpus[0]?.model || "Unknown",
      cores: cpus.length,
      speed: `${cpus[0]?.speed || 0} MHz`,
      loadAvg: {
        "1m": loadAvg[0].toFixed(2),
        "5m": loadAvg[1].toFixed(2),
        "15m": loadAvg[2].toFixed(2),
      },
      loadPercent: Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100)),
    };

    // --- RAM Info ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramInfo = {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      percent: Math.round((usedMem / totalMem) * 100),
    };

    // --- Disk Info ---
    let diskInfo = { total: "N/A", used: "N/A", free: "N/A", percent: 0 };
    const dfOutput = safeExec("df -B1 / | tail -1");
    if (dfOutput) {
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 5) {
        const total = parseInt(parts[1]);
        const used = parseInt(parts[2]);
        const free = parseInt(parts[3]);
        diskInfo = {
          total: formatBytes(total),
          used: formatBytes(used),
          free: formatBytes(free),
          percent: Math.round((used / total) * 100),
        };
      }
    }

    // --- PM2 Processes ---
    let pm2Processes: { name: string; pid: number; status: string; cpu: number; memory: string; uptime: string; restarts: number }[] = [];
    const pm2Output = safeExec("pm2 jlist 2>/dev/null");
    if (pm2Output) {
      try {
        const pm2Data = JSON.parse(pm2Output);
        pm2Processes = pm2Data.map((p: {
          name: string;
          pid: number;
          pm2_env?: {
            status?: string;
            restart_time?: number;
            pm_uptime?: number;
          };
          monit?: { cpu?: number; memory?: number };
        }) => ({
          name: p.name,
          pid: p.pid,
          status: p.pm2_env?.status || "unknown",
          cpu: p.monit?.cpu ?? 0,
          memory: formatBytes(p.monit?.memory ?? 0),
          uptime: p.pm2_env?.pm_uptime
            ? formatUptime(Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000))
            : "N/A",
          restarts: p.pm2_env?.restart_time ?? 0,
        }));
      } catch {
        // parse error
      }
    }

    // --- Cron Jobs ---
    let cronJobs: { schedule: string; command: string }[] = [];
    const crontabOutput = safeExec("crontab -l 2>/dev/null");
    if (crontabOutput) {
      cronJobs = crontabOutput
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const schedule = parts.slice(0, 5).join(" ");
          const command = parts.slice(5).join(" ");
          return { schedule, command };
        });
    }

    // --- Node.js Info ---
    const nodeInfo = {
      version: process.version,
      memoryUsage: formatBytes(process.memoryUsage().heapUsed),
      memoryTotal: formatBytes(process.memoryUsage().heapTotal),
    };

    return NextResponse.json({
      data: {
        system: systemInfo,
        cpu: cpuInfo,
        ram: ramInfo,
        disk: diskInfo,
        pm2: pm2Processes,
        cron: cronJobs,
        node: nodeInfo,
      },
    });
  } catch (err) {
    console.error("Server info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
