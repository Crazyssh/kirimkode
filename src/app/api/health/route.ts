import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Cek koneksi database
    const userCount = await db.user.count();
    const orderCount = await db.order.count();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: { users: userCount, orders: orderCount },
    });
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString(), db: null },
      { status: 503 }
    );
  }
}
