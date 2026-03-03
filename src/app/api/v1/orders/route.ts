import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
    const user = await authenticateApiKey(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: user.id };

    if (status && status !== "all") {
        where.status = status;
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

    return NextResponse.json({
        data: orders.map((o) => ({
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
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
