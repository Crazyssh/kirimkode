import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where: Record<string, unknown> = { userId: session.user.id };
  if (status && status !== "all") where.status = status;

  const MAX_EXPORT = 2000;

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT,
    }),
    db.order.count({ where }),
  ]);

  // Build CSV
  const headers = ["Tanggal", "Layanan", "Negara", "Nomor", "Kode OTP", "Harga", "Status", "Server"];
  const rows = orders.map((o) => [
    o.createdAt.toISOString().replace("T", " ").slice(0, 19),
    o.serviceName,
    o.country,
    o.number,
    o.code || "",
    o.price,
    o.status,
    o.server,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kirimkode-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Total-Count": String(totalCount),
      "X-Exported-Count": String(orders.length),
      "X-Max-Export": String(MAX_EXPORT),
    },
  });
}
