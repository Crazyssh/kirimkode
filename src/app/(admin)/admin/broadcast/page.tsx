"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Plus,
  Trash2,
  Loader2,
  Send,
  AlertCircle,
  Info,
  CheckCircle,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  active: boolean;
  createdAt: string;
}

export default function BroadcastPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/announcements");
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json.data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Judul dan isi pengumuman wajib diisi");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, type }),
      });
      if (res.ok) {
        setSuccess("Pengumuman berhasil dikirim!");
        setTitle("");
        setContent("");
        fetchAnnouncements();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal mengirim");
      }
    } catch {
      setError("Gagal mengirim pengumuman");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus pengumuman ini?")) return;
    try {
      await fetch("/api/admin/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchAnnouncements();
    } catch { /* silent */ }
  };

  const typeIcon = (t: string) => {
    if (t === "warning") return <AlertCircle className="w-4 h-4 text-warning" />;
    if (t === "success") return <CheckCircle className="w-4 h-4 text-success" />;
    return <Info className="w-4 h-4 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Broadcast Pengumuman
        </h1>
        <p className="text-sm text-muted">Kirim pengumuman yang tampil di dashboard semua user</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Form Kirim */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-primary" />
            Buat Pengumuman Baru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">Judul</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Isi Pesan</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis isi pengumuman..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Tipe</label>
              <div className="flex gap-2">
                {[
                  { value: "info", label: "Info", color: "primary" },
                  { value: "warning", label: "Peringatan", color: "warning" },
                  { value: "success", label: "Sukses", color: "success" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      type === t.value
                        ? `bg-${t.color}/20 text-${t.color} border border-${t.color}/30`
                        : "bg-surface-hover text-muted border border-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim Pengumuman
          </Button>
        </CardContent>
      </Card>

      {/* Daftar Pengumuman */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-4 h-4 text-primary" />
            Riwayat Pengumuman
            {announcements.length > 0 && <Badge variant="primary">{announcements.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada pengumuman</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-4 rounded-xl bg-background/50 border border-border">
                  {typeIcon(a.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{a.title}</span>
                      <Badge variant={a.active ? "success" : "error"} className="text-[9px]">
                        {a.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">{a.content}</p>
                    <p className="text-[10px] text-muted mt-1">
                      {new Date(a.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
