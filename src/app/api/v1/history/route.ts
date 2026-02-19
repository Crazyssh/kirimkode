import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, checkRateLimit } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ status: "error", message: "Invalid API key" }, { status: 401 });
  }
  const rateLimited = checkRateLimit(user.id);
  if (rateLimited) return rateLimited;

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("per_page")) || 20));
  const status = req.nextUrl.searchParams.get("status");

  const where: Record<string, unknown> = { userId: user.id };
  if (status && status !== "all") {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({
    status: "success",
    data: orders.map((o) => ({
      id: o.id,
      service: o.serviceName,
      country: o.country,
      number: o.number,
      code: o.code,
      status: o.status,
      price: o.price,
      created_at: o.createdAt.toISOString(),
    })),
    pagination: {
      page,
      per_page: perPage,
      total,
    },
  });
}
