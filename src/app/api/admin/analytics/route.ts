import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const days = Math.min(Number(req.nextUrl.searchParams.get("days")) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Build day ranges for per-day queries
    const dayRanges = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
    const [
      totalRevenueAgg,
      totalOrdersInPeriod,
      successOrdersInPeriod,
      totalDepositsAgg,
      topServicesGroup,
      topUsersOrders,
    ] = await Promise.all([
      db.order.aggregate({
        where: { status: "success", createdAt: { gte: startDate } },
        _sum: { price: true },
        _count: true,
      }),
      db.order.count({ where: { createdAt: { gte: startDate } } }),
      db.order.count({ where: { status: "success", createdAt: { gte: startDate } } }),
      db.deposit.aggregate({
        where: { status: "paid", paidAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ["serviceName"],
        where: { status: "success", createdAt: { gte: startDate } },
        _count: { serviceName: true },
        _sum: { price: true },
        orderBy: { _count: { serviceName: "desc" } },
        take: 10,
      }),
      db.order.groupBy({
        by: ["userId"],
        where: { status: "success", createdAt: { gte: startDate } },
        _count: { userId: true },
        _sum: { price: true },
        orderBy: { _count: { userId: "desc" } },
        take: 10,
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
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
