import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fingerprint, screenRes, userAgent } = await req.json();

    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json({ error: "Fingerprint diperlukan" }, { status: 400 });
    }

    // Ambil IP dari request headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";

    // Combo hash: fingerprint + IP + user agent + resolusi layar
    const comboString = [fingerprint, ip, userAgent || "", screenRes || ""].join("|");
    const comboHash = crypto.createHash("sha256").update(comboString).digest("hex");

    await db.user.update({
      where: { id: session.user.id },
      data: { fingerprint: comboHash },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan fingerprint" }, { status: 500 });
  }
}
