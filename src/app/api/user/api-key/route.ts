import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRouteRateLimit } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

function generateApiKey(): string {
  return `kk_${randomBytes(32).toString("hex")}`;
}

// POST: Generate atau regenerate API key (wajib konfirmasi password)
export async function POST(req: NextRequest) {
  // Rate limit: max 5 regenerate per IP per menit
  const rateLimited = checkRouteRateLimit(req, "api-key", 5, 60000);
  if (rateLimited) return rateLimited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { password } = body as { password?: string };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // User credentials wajib konfirmasi password sebelum regenerate
  if (user.password) {
    if (!password) {
      return NextResponse.json(
        { error: "Masukkan password untuk konfirmasi" },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Password salah" }, { status: 400 });
    }
  }

  const apiKey = generateApiKey();

  await db.user.update({
    where: { id: session.user.id },
    data: { apiKey },
  });

  logAction(session.user.id, "api_key_generate");

  return NextResponse.json({ success: true, data: { apiKey } });
}
