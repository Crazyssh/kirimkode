import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const posts = await db.blogPost.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: posts });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();

    const { slug, titleId, titleEn, excerptId, excerptEn, contentId, contentEn, category, tags, coverImage, status, metaTitleId, metaTitleEn, metaDescId, metaDescEn, authorName } = body;

    if (!slug || !titleId || !titleEn || !excerptId || !excerptEn || !contentId || !contentEn) {
      return NextResponse.json({ error: "Slug, title, excerpt, dan content (ID & EN) wajib diisi" }, { status: 400 });
    }

    const existing = await db.blogPost.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 400 });
    }

    const post = await db.blogPost.create({
      data: {
        slug,
        titleId,
        titleEn,
        excerptId,
        excerptEn,
        contentId,
        contentEn,
        category: category || "tips",
        tags: tags || "",
        coverImage: coverImage || null,
        status: status || "draft",
        publishedAt: status === "published" ? new Date() : null,
        metaTitleId: metaTitleId || null,
        metaTitleEn: metaTitleEn || null,
        metaDescId: metaDescId || null,
        metaDescEn: metaDescEn || null,
        authorName: authorName || "KirimKode Team",
      },
    });

    return NextResponse.json({ data: post });
  } catch (err) {
    console.error("Blog create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
