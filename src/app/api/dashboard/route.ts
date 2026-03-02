import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, orders, todayOrders, deposits] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    }),
    db.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.order.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z") },
      },
    }),
    db.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalOrders = await db.order.count({ where: { userId } });
  const successOrders = await db.order.count({ where: { userId, status: "success" } });
  const failedOrders = await db.order.count({ where: { userId, status: { in: ["cancelled", "timeout"] } } });
  const todayCount = todayOrders.length;

  // Pengeluaran bulan ini
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthlySpent = await db.order.aggregate({
    where: { userId, status: "success", createdAt: { gte: monthStart } },
    _sum: { price: true },
  });

  // Layanan favorit (most ordered service)
  const topService = await db.order.groupBy({
    by: ["serviceName"],
    where: { userId },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });

  return NextResponse.json({
    data: {
      balance: user?.balance ?? 0,
      stats: {
        totalOrders,
        successOrders,
        failedOrders,
        todayCount,
        successRate: totalOrders > 0 ? Math.round((successOrders / totalOrders) * 100) : 0,
        monthlySpent: monthlySpent._sum.price ?? 0,
        topService: topService[0]?.serviceName ?? null,
        topServiceCount: topService[0]?._count.id ?? 0,
      },
      recentOrders: orders.map((o) => ({
        id: o.id,
        service: o.serviceName,
        country: o.country,
        number: o.number,
        code: o.code,
        status: o.status,
        price: o.price,
        time: o.createdAt.toISOString(),
      })),
      recentDeposits: deposits.map((d) => ({
        id: d.id,
        trxId: d.trxId,
        amount: d.amount,
        method: d.channelName,
        status: d.status,
        time: d.createdAt.toISOString(),
      })),
    },
  });
}
