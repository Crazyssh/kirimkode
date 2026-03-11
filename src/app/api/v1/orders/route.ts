import { withApiAuth } from "@/lib/api-auth";
import { apiPaginated, parsePagination } from "@/lib/api-response";
import { db } from "@/lib/db";

export const GET = withApiAuth(async (req, user) => {
  const { page, limit, offset } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get("status");

  const where: Record<string, unknown> = { userId: user.id };
  if (status && status !== "all") {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    db.order.count({ where }),
  ]);

  return apiPaginated(
    orders.map((o) => ({
      id: o.id,
      order_id: o.orderId,
      service: o.serviceName,
      country: o.country,
      number: o.number,
      code: o.code,
      status: o.status,
      price: o.price,
      server: o.server,
      created_at: o.createdAt.toISOString(),
    })),
    {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    }
  );
});
