import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs = await db.auditLog.findMany({
      where: { userId: session.user.id, action: "login" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      data: logs.map((l) => ({
        id: l.id,
        ip: l.ip,
        detail: l.detail,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
