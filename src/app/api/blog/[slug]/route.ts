import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const post = await db.blogPost.findUnique({
      where: { slug },
    });

    if (!post || post.status !== "published") {
      return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
    }

    // Increment views (fire-and-forget)
    db.blogPost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json({ data: post });
  } catch (err) {
    console.error("Blog detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
