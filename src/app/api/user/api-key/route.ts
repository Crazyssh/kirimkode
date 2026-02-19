import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

function generateApiKey(): string {
  return `kk_${randomBytes(32).toString("hex")}`;
}

// POST: Generate or regenerate API key
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = generateApiKey();

  await db.user.update({
    where: { id: session.user.id },
    data: { apiKey },
  });

  return NextResponse.json({ success: true, data: { apiKey } });
}
