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

  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });

  return NextResponse.json({
    status: "success",
    data: {
      balance: userData?.balance ?? 0,
      currency: "IDR",
    },
  });
}
