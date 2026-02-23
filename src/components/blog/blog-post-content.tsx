"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Eye, User } from "lucide-react";
import Link from "next/link";
import { useLanguageStore } from "@/store/language";
import { MarkdownRenderer } from "./markdown-renderer";

interface SerializedPost {
  id: string;
  slug: string;
  titleId: string;
  titleEn: string;
  excerptId: string;
  excerptEn: string;
  contentId: string;
  contentEn: string;
  category: string;
  tags: string;
  views: number;
  publishedAt: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export function BlogPostContent({ post }: { post: SerializedPost }) {
  const { locale } = useLanguageStore();

  // Increment views
  useEffect(() => {
    fetch(`/api/blog/${post.slug}`).catch(() => {});
  }, [post.slug]);

  const title = locale === "en" ? post.titleEn : post.titleId;
  const content = locale === "en" ? post.contentEn : post.contentId;
  const tags = post.tags ? post.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <article className="space-y-8">
      {/* Back button */}
      <Link href="/blog">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {locale === "en" ? "Back to Blog" : "Kembali ke Blog"}
        </Button>
      </Link>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="primary">{post.category}</Badge>
          {tags.map((tag) => (
            <Badge key={tag} variant="primary" className="opacity-60">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] leading-tight">
          {title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {post.authorName}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.views} {locale === "en" ? "views" : "dilihat"}
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="border-t border-border pt-8">
        <MarkdownRenderer content={content} />
      </div>

      {/* CTA */}
      <div className="p-6 rounded-xl bg-primary/5 border border-primary/20 text-center">
        <h3 className="font-bold mb-2 font-[family-name:var(--font-space-grotesk)]">
          {locale === "en"
            ? "Need a Virtual Number for OTP?"
            : "Butuh Nomor Virtual untuk OTP?"}
        </h3>
        <p className="text-sm text-muted mb-4">
          {locale === "en"
            ? "Get instant virtual numbers from 200+ countries starting at Rp 1,200."
            : "Dapatkan nomor virtual instan dari 200+ negara mulai dari Rp 1.200."}
        </p>
        <Link href="/register">
          <Button>
            {locale === "en" ? "Try KirimKode Free" : "Coba KirimKode Gratis"}
          </Button>
        </Link>
      </div>

      {/* Back */}
      <div className="border-t border-border pt-6">
        <Link href="/blog">
          <Button variant="secondary" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {locale === "en" ? "Back to Blog" : "Kembali ke Blog"}
          </Button>
        </Link>
      </div>
    </article>
  );
}
