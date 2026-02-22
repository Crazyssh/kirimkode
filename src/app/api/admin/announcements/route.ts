import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

// GET: List announcements (admin)
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const announcements = await db.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: announcements });
}

// POST: Create announcement
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { title, content, type } = await req.json();

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title dan content diperlukan" }, { status: 400 });
  }

  const validTypes = ["info", "warning", "success"];
  const safeType = validTypes.includes(type) ? type : "info";

  const announcement = await db.announcement.create({
    data: { title: title.trim(), content: content.trim(), type: safeType },
  });

  return NextResponse.json({ success: true, data: announcement });
}

// DELETE: Delete announcement
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
  }

  await db.announcement.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
