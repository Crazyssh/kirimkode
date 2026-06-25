import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));
  const action = req.nextUrl.searchParams.get("action");
  const userId = req.nextUrl.searchParams.get("userId");
  const email = req.nextUrl.searchParams.get("email")?.trim();
  const detail = req.nextUrl.searchParams.get("detail")?.trim();

  const where: Record<string, unknown> = {};
  if (action && action !== "all") where.action = action;
  if (userId) where.userId = userId;
  // Cari berdasarkan email user (partial, case-insensitive)
  if (email) {
    where.user = { email: { contains: email, mode: "insensitive" } };
  }
  // Cari teks di kolom detail (mis. 'refunded":true' / 'refunded":false' / orderId)
  if (detail) {
    where.detail = { contains: detail, mode: "insensitive" };
  }

  try {
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        userName: l.user.name,
        userEmail: l.user.email,
        action: l.action,
        detail: l.detail,
        ip: l.ip,
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ error: "Gagal memuat audit log" }, { status: 500 });
  }
}
