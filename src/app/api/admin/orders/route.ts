import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const status = searchParams.get("status");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { serviceName: { contains: search, mode: "insensitive" } },
        { number: { contains: search } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      data: orders.map((o) => ({
        id: o.id,
        service: o.serviceName,
        country: o.country,
        number: o.number,
        code: o.code,
        status: o.status,
        price: o.price,
        server: o.server,
        source: o.source,
        userEmail: o.user?.email ?? "-",
        time: o.createdAt.toISOString(),
        waCheck: o.waCheck ? JSON.parse(o.waCheck) : null,
        tgCheck: o.tgCheck ? JSON.parse(o.tgCheck) : null,
        checkedAt: o.checkedAt?.toISOString() ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Admin orders list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
