import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
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

    // --- Database Info (PostgreSQL) ---
    interface DbStats {
      version: string;
      sizeBytes: number;
      sizePretty: string;
      connections: number;
      maxConnections: number;
      cacheHitRatio: number; // 0-100 (%)
      uptimeSeconds: number;
      uptimePretty: string;
      topTables: Array<{ table: string; rows: number; size: string }>;
      slowQueriesEnabled: boolean;
      latencyMs: number;
    }

    async function safeQuery<T>(query: string): Promise<T[]> {
      try {
        return await db.$queryRawUnsafe<T[]>(query);
      } catch (e) {
        console.warn(`[server-info] DB query failed: ${query.slice(0, 80)}... → ${(e as Error).message}`);
        return [];
      }
    }

    let dbInfo: DbStats | null = null;
    try {
      const tStart = Date.now();

      // Run each query independently — kalau permission ditolak di salah satu,
      // yang lain tetep bisa muncul.
      const [versionRes, sizeRes, connRes, maxConnRes, cacheRes, uptimeRes, tableRes] = await Promise.all([
        safeQuery<{ version: string }>(`SELECT current_setting('server_version_num') AS version`),
        safeQuery<{ size: bigint; pretty: string }>(
          `SELECT pg_database_size(current_database())::bigint AS size, pg_size_pretty(pg_database_size(current_database())) AS pretty`
        ),
        safeQuery<{ count: bigint }>(
          `SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database()`
        ),
        safeQuery<{ setting: string }>(`SELECT setting FROM pg_settings WHERE name = 'max_connections'`),
        safeQuery<{ ratio: number | null }>(
          `SELECT
             CASE WHEN sum(blks_hit) + sum(blks_read) = 0 THEN 0
                  ELSE (sum(blks_hit)::float / (sum(blks_hit) + sum(blks_read))::float) * 100
             END AS ratio
           FROM pg_stat_database WHERE datname = current_database()`
        ),
        safeQuery<{ uptime: number }>(
          `SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::int AS uptime`
        ),
        safeQuery<{ relname: string; rows: bigint; size: string }>(
          `SELECT
             c.relname,
             COALESCE(s.n_live_tup, 0)::bigint AS rows,
             pg_size_pretty(pg_total_relation_size(c.oid)) AS size
           FROM pg_class c
           LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
           WHERE c.relkind = 'r'
             AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
           ORDER BY pg_total_relation_size(c.oid) DESC
           LIMIT 5`
        ),
      ]);

      const latencyMs = Date.now() - tStart;
      const versionNum = parseInt(versionRes[0]?.version || "0", 10);
      const major = Math.floor(versionNum / 10000);
      const minor = versionNum % 10000;
      const versionStr = versionNum > 0 ? `PostgreSQL ${major}.${minor}` : "PostgreSQL";

      const uptimeSeconds = Number(uptimeRes[0]?.uptime || 0);

      dbInfo = {
        version: versionStr,
        sizeBytes: Number(sizeRes[0]?.size || 0),
        sizePretty: sizeRes[0]?.pretty || "N/A",
        connections: Number(connRes[0]?.count || 0),
        maxConnections: parseInt(maxConnRes[0]?.setting || "0", 10),
        cacheHitRatio: Math.round((cacheRes[0]?.ratio || 0) * 10) / 10,
        uptimeSeconds,
        uptimePretty: uptimeSeconds > 0 ? formatUptime(uptimeSeconds) : "N/A",
        topTables: tableRes.map((t) => ({
          table: t.relname,
          rows: Number(t.rows),
          size: t.size,
        })),
        slowQueriesEnabled: false,
        latencyMs,
      };
    } catch (err) {
      console.error("[server-info] DB stats fatal error:", err);
    }

    return NextResponse.json({
      data: {
        system: systemInfo,
        cpu: cpuInfo,
        ram: ramInfo,
        disk: diskInfo,
        pm2: pm2Processes,
        cron: cronJobs,
        node: nodeInfo,
        db: dbInfo,
      },
    });
  } catch (err) {
    console.error("Server info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
