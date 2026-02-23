import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Artikel tidak ditemukan" }, { status: 404 });
    }

    // Cek slug unik jika diubah
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.blogPost.findUnique({ where: { slug: body.slug } });
      if (slugExists) {
        return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 400 });
      }
    }

    // Set publishedAt saat pertama kali publish
    let publishedAt = existing.publishedAt;
    if (body.status === "published" && !existing.publishedAt) {
      publishedAt = new Date();
    } else if (body.status === "draft") {
      publishedAt = null;
    }

    const post = await db.blogPost.update({
      where: { id },
      data: {
        slug: body.slug ?? existing.slug,
        titleId: body.titleId ?? existing.titleId,
        titleEn: body.titleEn ?? existing.titleEn,
        excerptId: body.excerptId ?? existing.excerptId,
        excerptEn: body.excerptEn ?? existing.excerptEn,
        contentId: body.contentId ?? existing.contentId,
        contentEn: body.contentEn ?? existing.contentEn,
        category: body.category ?? existing.category,
        tags: body.tags ?? existing.tags,
        coverImage: body.coverImage ?? existing.coverImage,
        status: body.status ?? existing.status,
        publishedAt,
        metaTitleId: body.metaTitleId ?? existing.metaTitleId,
        metaTitleEn: body.metaTitleEn ?? existing.metaTitleEn,
        metaDescId: body.metaDescId ?? existing.metaDescId,
        metaDescEn: body.metaDescEn ?? existing.metaDescEn,
        authorName: body.authorName ?? existing.authorName,
      },
    });

    return NextResponse.json({ data: post });
  } catch (err) {
    console.error("Blog update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    await db.blogPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Blog delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
