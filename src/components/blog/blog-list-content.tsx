"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import { useLanguageStore } from "@/store/language";

interface BlogPost {
  id: string;
  slug: string;
  titleId: string;
  titleEn: string;
  excerptId: string;
  excerptEn: string;
  category: string;
  tags: string;
  views: number;
  publishedAt: string;
  authorName: string;
}

const categories = [
  { value: "", labelId: "Semua", labelEn: "All" },
  { value: "tutorial", labelId: "Tutorial", labelEn: "Tutorial" },
  { value: "tips", labelId: "Tips", labelEn: "Tips" },
  { value: "guide", labelId: "Panduan", labelEn: "Guide" },
  { value: "news", labelId: "Berita", labelEn: "News" },
];

export function BlogListContent() {
  const { locale } = useLanguageStore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "9" });
      if (category) params.set("category", category);

      const res = await fetch(`/api/blog?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPosts(json.data);
        setTotalPages(json.pagination.totalPages);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
          Blog
        </h1>
        <p className="text-muted">
          {locale === "en"
            ? "Tips, tutorials & guides about virtual numbers and OTP verification."
            : "Tips, tutorial & panduan seputar nomor virtual dan verifikasi OTP."}
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              category === cat.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-surface text-muted border border-border hover:border-primary/30"
            }`}
          >
            {locale === "en" ? cat.labelEn : cat.labelId}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>{locale === "en" ? "No articles yet." : "Belum ada artikel."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="h-full hover:border-primary/30 transition-all group cursor-pointer">
                <CardContent className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="primary">{post.category}</Badge>
                    <span className="text-[10px] text-muted flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {post.views}
                    </span>
                  </div>
                  <h2 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {locale === "en" ? post.titleEn : post.titleId}
                  </h2>
                  <p className="text-sm text-muted mb-4 line-clamp-3 flex-1">
                    {locale === "en" ? post.excerptEn : post.excerptId}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-muted">
                      {new Date(post.publishedAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {locale === "en" ? "Previous" : "Sebelumnya"}
          </Button>
          <span className="flex items-center px-3 text-sm text-muted">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {locale === "en" ? "Next" : "Selanjutnya"}
          </Button>
        </div>
      )}
    </div>
  );
}
