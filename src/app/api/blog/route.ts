import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(20, Number(searchParams.get("limit")) || 9);
    const category = searchParams.get("category") || "";

    const where = {
      status: "published" as const,
      ...(category && { category }),
    };

    const [posts, total] = await Promise.all([
      db.blogPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          titleId: true,
          titleEn: true,
          excerptId: true,
          excerptEn: true,
          category: true,
          tags: true,
          coverImage: true,
          views: true,
          publishedAt: true,
          authorName: true,
        },
      }),
      db.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Blog list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
