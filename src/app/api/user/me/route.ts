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

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        balance: true,
        role: true,
        apiKey: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch new fields separately to avoid crash if they don't exist yet
    let extras = { webhookUrl: null as string | null, favorites: "", theme: "dark" };
    try {
      const full = await db.user.findUnique({
        where: { id: session.user.id },
        select: { webhookUrl: true, favorites: true, theme: true },
      });
      if (full) {
        extras = {
          webhookUrl: full.webhookUrl,
          favorites: full.favorites,
          theme: full.theme,
        };
      }
    } catch {
      // New fields might not exist yet in DB - use defaults
    }

    return NextResponse.json({ data: { ...user, ...extras } }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    console.error("[/api/user/me] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
