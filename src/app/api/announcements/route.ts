import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: Active announcements for users
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const announcements = await db.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ data: announcements });
  } catch {
    // Announcement table might not exist yet
    return NextResponse.json({ data: [] });
  }
}
