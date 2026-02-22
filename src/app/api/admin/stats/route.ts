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
    const orders = await db.order.findMany({
      select: { status: true },
    });
    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    }

    // Sum of paid deposits
    const paidDeposits = await db.deposit.findMany({
      where: { status: "paid" },
      select: { amount: true },
    });
    const depositsPaidTotal = paidDeposits.reduce((sum, d) => sum + d.amount, 0);

    // Top 5 services by order count
    const allOrders = await db.order.findMany({
      select: { serviceName: true },
    });
    const serviceCount: Record<string, number> = {};
    for (const o of allOrders) {
      if (o.serviceName) {
        serviceCount[o.serviceName] = (serviceCount[o.serviceName] || 0) + 1;
      }
    }
    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Revenue (sum of successful order prices)
    const revenueResult = await db.order.aggregate({
      where: { status: "success" },
      _sum: { price: true },
    });
    const totalRevenue = revenueResult._sum.price ?? 0;

    // Orders per day (last 7 days)
    const ordersPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const count = await db.order.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      ordersPerDay.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

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
