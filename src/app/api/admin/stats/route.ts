import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const [
      totalUsers,
      newUsersToday,
      totalOrders,
      ordersToday,
      totalDeposits,
      recentOrders,
      recentDeposits,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: todayStart } } }),
      db.order.count(),
      db.order.count({ where: { createdAt: { gte: todayStart } } }),
      db.deposit.count(),
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.deposit.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    // Count orders grouped by status
    const ordersByStatusGroup = await db.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    const ordersByStatus: Record<string, number> = {};
    for (const g of ordersByStatusGroup) {
      ordersByStatus[g.status] = g._count.status;
    }

    // Sum of paid deposits
    const paidDepositAgg = await db.deposit.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    });
    const depositsPaidTotal = paidDepositAgg._sum.amount ?? 0;

    // Top 5 services by order count
    const topServicesGroup = await db.order.groupBy({
      by: ["serviceName"],
      where: { status: "success" },
      _count: { serviceName: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 5,
    });
    const topServices = topServicesGroup.map((g) => ({
      name: g.serviceName,
      count: g._count.serviceName,
    }));

    // Revenue (sum of successful order prices)
    const [revenueResult, revenueTodayResult, depositsTodayResult] = await Promise.all([
      db.order.aggregate({
        where: { status: "success" },
        _sum: { price: true },
      }),
      db.order.aggregate({
        where: { status: "success", createdAt: { gte: todayStart } },
        _sum: { price: true },
      }),
      db.deposit.aggregate({
        where: { status: "paid", paidAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
    ]);
    const totalRevenue = revenueResult._sum.price ?? 0;
    const revenueToday = revenueTodayResult._sum.price ?? 0;
    const depositsTodayTotal = depositsTodayResult._sum.amount ?? 0;

    // Orders per day (last 7 days) — parallel batch instead of sequential loop
    const dayRanges = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      return { dayStart, dayEnd };
    });
    const ordersPerDayCounts = await Promise.all(
      dayRanges.map(({ dayStart, dayEnd }) =>
        db.order.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } })
      )
    );
    const ordersPerDay = dayRanges.map(({ dayStart }, idx) => ({
      date: dayStart.toISOString().slice(0, 10),
      count: ordersPerDayCounts[idx],
    }));

    // Active users (ordered in last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const activeUsersWeek = await db.order.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { userId: true },
      distinct: ["userId"],
    });

    return NextResponse.json({
      data: {
        totalUsers,
        newUsersToday,
        activeUsersWeek: activeUsersWeek.length,
        totalRevenue,
        revenueToday,
        depositsTodayTotal,
        ordersPerDay,
        totalOrders,
        ordersToday,
        ordersByStatus,
        totalDeposits,
        depositsPaidTotal,
        topServices,
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          userEmail: o.user?.email ?? "-",
          service: o.serviceName,
          status: o.status,
          price: o.price,
          time: o.createdAt.toISOString(),
        })),
        recentDeposits: recentDeposits.map((d) => ({
          id: d.id,
          userEmail: d.user?.email ?? "-",
          amount: d.amount,
          status: d.status,
          channel: d.channelName,
          time: d.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
