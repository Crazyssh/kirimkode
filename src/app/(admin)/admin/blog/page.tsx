"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Save,
  Eye,
  Edit2,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface BlogPost {
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
  coverImage: string | null;
  status: string;
  publishedAt: string | null;
  views: number;
  metaTitleId: string | null;
  metaTitleEn: string | null;
  metaDescId: string | null;
  metaDescEn: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  slug: "",
  titleId: "",
  titleEn: "",
  excerptId: "",
  excerptEn: "",
  contentId: "",
  contentEn: "",
  category: "tips",
  tags: "",
  coverImage: "",
  status: "draft",
  authorName: "KirimKode Team",
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/blog");
      if (res.ok) {
        const json = await res.json();
        setPosts(json.data);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      slug: post.slug,
      titleId: post.titleId,
      titleEn: post.titleEn,
      excerptId: post.excerptId,
      excerptEn: post.excerptEn,
      contentId: post.contentId,
      contentEn: post.contentEn,
      category: post.category,
      tags: post.tags,
      coverImage: post.coverImage || "",
      status: post.status,
      authorName: post.authorName,
    });
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    if (!form.slug || !form.titleId || !form.titleEn || !form.excerptId || !form.excerptEn || !form.contentId || !form.contentEn) {
      setError("Slug, judul, ringkasan, dan konten (ID & EN) wajib diisi");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const url = editingId ? `/api/admin/blog/${editingId}` : "/api/admin/blog";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSuccess(editingId ? "Artikel berhasil diperbarui!" : "Artikel berhasil dibuat!");
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchPosts();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch {
      setError("Gagal menyimpan artikel");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus artikel ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      fetchPosts();
    } catch {
      /* silent */
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    try {
      await fetch(`/api/admin/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPosts();
    } catch {
      /* silent */
    }
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
              {editingId ? "Edit Artikel" : "Buat Artikel Baru"}
            </h1>
            <p className="text-sm text-muted">Isi konten dalam bahasa Indonesia dan Inggris</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bahasa Indonesia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bahasa Indonesia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted block mb-1">Judul</label>
                <Input
                  value={form.titleId}
                  onChange={(e) => {
                    setForm({ ...form, titleId: e.target.value });
                    if (!editingId) setForm((f) => ({ ...f, titleId: e.target.value, slug: generateSlug(e.target.value) }));
                  }}
                  placeholder="Judul artikel dalam Bahasa Indonesia"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Ringkasan (untuk meta description)</label>
                <textarea
                  value={form.excerptId}
                  onChange={(e) => setForm({ ...form, excerptId: e.target.value })}
                  placeholder="Ringkasan singkat 1-2 kalimat..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Konten (Markdown)</label>
                <textarea
                  value={form.contentId}
                  onChange={(e) => setForm({ ...form, contentId: e.target.value })}
                  placeholder="Tulis konten artikel dalam format Markdown..."
                  rows={15}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none font-[family-name:var(--font-jetbrains-mono)]"
                />
              </div>
            </CardContent>
          </Card>

          {/* English */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">English</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted block mb-1">Title</label>
                <Input
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  placeholder="Article title in English"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Excerpt (for meta description)</label>
                <textarea
                  value={form.excerptEn}
                  onChange={(e) => setForm({ ...form, excerptEn: e.target.value })}
                  placeholder="Short summary 1-2 sentences..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Content (Markdown)</label>
                <textarea
                  value={form.contentEn}
                  onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                  placeholder="Write article content in Markdown format..."
                  rows={15}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none font-[family-name:var(--font-jetbrains-mono)]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted block mb-1">Slug (URL)</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="slug-artikel"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
                >
                  <option value="tutorial">Tutorial</option>
                  <option value="tips">Tips</option>
                  <option value="news">News</option>
                  <option value="guide">Guide</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted block mb-1">Tags (pisah koma)</label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="whatsapp, otp, verifikasi"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Author</label>
                <Input
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  placeholder="KirimKode Team"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Blog Management
          </h1>
          <p className="text-sm text-muted">Kelola artikel blog untuk SEO & content marketing</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4" /> Buat Artikel
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            Semua Artikel
            {posts.length > 0 && <Badge variant="primary">{posts.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada artikel</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-3 font-medium">Judul</th>
                    <th className="pb-3 font-medium">Kategori</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Views</th>
                    <th className="pb-3 font-medium">Tanggal</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b border-border/50 hover:bg-surface/30 transition-colors">
                      <td className="py-3">
                        <div className="max-w-[300px]">
                          <div className="font-medium truncate">{post.titleId}</div>
                          <div className="text-xs text-muted truncate">/blog/{post.slug}</div>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant="primary">{post.category}</Badge>
                      </td>
                      <td className="py-3">
                        <button onClick={() => handleToggleStatus(post)}>
                          <Badge variant={post.status === "published" ? "success" : "error"}>
                            {post.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3 text-muted">{post.views}</td>
                      <td className="py-3 text-muted text-xs">
                        {new Date(post.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {post.status === "published" && (
                            <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(post)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(post.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
