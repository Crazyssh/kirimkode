import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET: List announcements (admin)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const announcements = await db.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: announcements });
}

// POST: Create announcement
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, content, type } = await req.json();
  if (!title || !content) {
    return NextResponse.json({ error: "Title dan content diperlukan" }, { status: 400 });
  }

  const announcement = await db.announcement.create({
    data: { title, content, type: type || "info" },
  });

  return NextResponse.json({ success: true, data: announcement });
}

// DELETE: Delete announcement
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await db.announcement.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
