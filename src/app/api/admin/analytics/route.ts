import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/**
 * Resolve preset period ke {startDate, endDateExclusive, label, days}.
 *
 * Support:
 *   - "1d", "3d", "7d", "30d", "90d" → window relatif (hari terakhir)
 *   - "this_month" → kalender bulan berjalan dari tanggal 1 sampai sekarang
 *   - "last_month" → kalender bulan lalu (full month)
 *   - Legacy `?days=N` (number) → fallback ke window relatif
 */
function resolvePeriod(req: NextRequest): {
  startDate: Date;
  endDateExclusive: Date;
  days: number;
  label: string;
} {
  const now = new Date();
  const periodParam = req.nextUrl.searchParams.get("period");
  const daysParam = req.nextUrl.searchParams.get("days");

  // Calendar months
  if (periodParam === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return { startDate: start, endDateExclusive: end, days, label: "this_month" };
  }
  if (periodParam === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return { startDate: start, endDateExclusive: end, days, label: "last_month" };
  }

  // Relative window (1d, 3d, 7d, 30d, 90d) atau legacy days=N
  let days = 30;
  if (periodParam && /^\d+d$/.test(periodParam)) {
    days = parseInt(periodParam, 10);
  } else if (daysParam) {
    days = Number(daysParam) || 30;
  }
  days = Math.min(Math.max(1, days), 365);

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(todayEnd);
  start.setDate(start.getDate() - days);
  return { startDate: start, endDateExclusive: todayEnd, days, label: `${days}d` };
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { startDate, endDateExclusive, days, label: periodLabel } = resolvePeriod(req);

    // Build day ranges for per-day queries
    const dayRanges = Array.from({ length: days }, (_, i) => {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      return { dayStart, dayEnd, label: dayStart.toISOString().slice(0, 10) };
    });

    // Parallel: per-day revenue, deposits, users, orders
    const [revPerDay, depPerDay, usersPerDay, ordersPerDay] = await Promise.all([
      Promise.all(
        dayRanges.map(({ dayStart, dayEnd }) =>
          db.order.aggregate({
            where: { status: "success", createdAt: { gte: dayStart, lt: dayEnd } },
            _sum: { price: true },
          })
        )
      ),
      Promise.all(
        dayRanges.map(({ dayStart, dayEnd }) =>
          db.deposit.aggregate({
            where: { status: "paid", paidAt: { gte: dayStart, lt: dayEnd } },
            _sum: { amount: true },
          })
        )
      ),
      Promise.all(
        dayRanges.map(({ dayStart, dayEnd }) =>
          db.user.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } })
        )
      ),
      Promise.all(
        dayRanges.map(({ dayStart, dayEnd }) =>
          db.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } })
        )
      ),
    ]);

    const revenuePerDay = dayRanges.map((d, i) => ({
      date: d.label,
      amount: revPerDay[i]._sum.price ?? 0,
    }));

    const depositsPerDay = dayRanges.map((d, i) => ({
      date: d.label,
      amount: depPerDay[i]._sum.amount ?? 0,
    }));

    const newUsersPerDay = dayRanges.map((d, i) => ({
      date: d.label,
      count: usersPerDay[i],
    }));

    const ordersPerDayData = dayRanges.map((d, i) => ({
      date: d.label,
      count: ordersPerDay[i],
    }));

    // Aggregated stats for the period
    const dateRange = { gte: startDate, lt: endDateExclusive };
    const depositDateRange = { gte: startDate, lt: endDateExclusive };

    const [
      totalRevenueAgg,
      totalOrdersInPeriod,
      successOrdersInPeriod,
      totalDepositsAgg,
      topServicesGroup,
      topUsersOrders,
      perServerGroup,
    ] = await Promise.all([
      db.order.aggregate({
        where: { status: "success", createdAt: dateRange },
        _sum: { price: true },
        _count: true,
      }),
      db.order.count({ where: { createdAt: dateRange } }),
      db.order.count({ where: { status: "success", createdAt: dateRange } }),
      db.deposit.aggregate({
        where: { status: "paid", paidAt: depositDateRange },
        _sum: { amount: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ["serviceName"],
        where: { status: "success", createdAt: dateRange },
        _count: { serviceName: true },
        _sum: { price: true },
        orderBy: { _count: { serviceName: "desc" } },
        take: 10,
      }),
      db.order.groupBy({
        by: ["userId"],
        where: { status: "success", createdAt: dateRange },
        _count: { userId: true },
        _sum: { price: true },
        orderBy: { _count: { userId: "desc" } },
        take: 10,
      }),
      // Per-server: hanya order success (sesuai request user — pendapatan & order success per server)
      db.order.groupBy({
        by: ["server"],
        where: { status: "success", createdAt: dateRange },
        _count: { server: true },
        _sum: { price: true },
        orderBy: { _sum: { price: "desc" } },
      }),
    ]);

    // Fetch user info for top users
    const topUserIds = topUsersOrders.map((u) => u.userId);
    const topUserInfos = topUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const userMap = new Map(topUserInfos.map((u) => [u.id, u]));

    const totalRevenue = totalRevenueAgg._sum.price ?? 0;
    const totalDeposits = totalDepositsAgg._sum.amount ?? 0;
    const successRate = totalOrdersInPeriod > 0
      ? Math.round((successOrdersInPeriod / totalOrdersInPeriod) * 100)
      : 0;
    const avgOrderValue = totalRevenueAgg._count > 0
      ? Math.round(totalRevenue / totalRevenueAgg._count)
      : 0;

    return NextResponse.json({
      data: {
        period: days,
        periodLabel,
        startDate: startDate.toISOString(),
        endDate: endDateExclusive.toISOString(),
        summary: {
          totalRevenue,
          totalDeposits,
          totalOrders: totalOrdersInPeriod,
          successOrders: successOrdersInPeriod,
          successRate,
          avgOrderValue,
        },
        revenuePerDay,
        depositsPerDay,
        newUsersPerDay,
        ordersPerDay: ordersPerDayData,
        topServices: topServicesGroup.map((g) => ({
          name: g.serviceName,
          count: g._count.serviceName,
          revenue: g._sum.price ?? 0,
        })),
        topUsers: topUsersOrders.map((g) => {
          const user = userMap.get(g.userId);
          return {
            email: user?.email ?? "-",
            name: user?.name ?? "-",
            orders: g._count.userId,
            spent: g._sum.price ?? 0,
          };
        }),
        perServer: perServerGroup.map((g) => ({
          server: g.server,
          successOrders: g._count.server,
          revenue: g._sum.price ?? 0,
        })),
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
