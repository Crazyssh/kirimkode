import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCancelMinMsFor } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const status = searchParams.get("status"); // success | cancelled | waiting
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { userId: session.user.id };

  if (status && status !== "all") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { serviceName: { contains: search } },
      { number: { contains: search } },
      { id: { contains: search } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.order.count({ where }),
  ]);

  // Hitung cancelMinMs per order (aturan per-layanan admin, fallback per-server).
  const data = await Promise.all(
    orders.map(async (o) => ({
      id: o.id,
      service: o.serviceName,
      country: o.country,
      number: o.number,
      code: o.code,
      status: o.status,
      price: o.price,
      date: o.createdAt.toISOString(),
      server: o.server,
      orderId: o.orderId,
      cancelMinMs: await getCancelMinMsFor(o.server, o.service),
      waCheck: o.waCheck ? JSON.parse(o.waCheck) : null,
      tgCheck: o.tgCheck ? JSON.parse(o.tgCheck) : null,
      checkedAt: o.checkedAt?.toISOString() ?? null,
      resendAt: o.resendAt?.toISOString() ?? null,
    }))
  );

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
