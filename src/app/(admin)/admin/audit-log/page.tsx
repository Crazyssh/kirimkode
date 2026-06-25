"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Loader2, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

interface AuditEntry {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

const actionLabels: Record<string, { label: string; variant: "success" | "warning" | "error" | "primary" | "default" }> = {
  order: { label: "Order", variant: "primary" },
  cancel: { label: "Batal", variant: "error" },
  deposit: { label: "Deposit", variant: "success" },
  login: { label: "Login", variant: "default" },
  settings_update: { label: "Settings", variant: "warning" },
  api_key_generate: { label: "API Key", variant: "primary" },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [emailSearch, setEmailSearch] = useState("");
  // debounced value yang dipakai untuk query
  const [emailQuery, setEmailQuery] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [detailQuery, setDetailQuery] = useState("");

  // Debounce input email 400ms biar gak query tiap ketik
  useEffect(() => {
    const t = setTimeout(() => setEmailQuery(emailSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [emailSearch]);

  // Debounce input detail 400ms
  useEffect(() => {
    const t = setTimeout(() => setDetailQuery(detailSearch.trim()), 400);
    return () => clearTimeout(t);
  }, [detailSearch]);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (filter !== "all") params.set("action", filter);
      if (emailQuery) params.set("email", emailQuery);
      if (detailQuery) params.set("detail", detailQuery);
      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data);
        setPage(json.pagination.page);
        setTotalPages(json.pagination.totalPages);
        setTotal(json.pagination.total);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filter, emailQuery, detailQuery]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Audit Log
        </h1>
        <p className="text-sm text-muted">Semua aktivitas user dalam sistem</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="w-4 h-4 text-primary" />
              Log Aktivitas
              {total > 0 && <span className="text-muted font-normal text-sm">({total})</span>}
            </CardTitle>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "order", "cancel", "deposit", "login", "settings_update", "api_key_generate"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    filter === f ? "bg-primary text-background" : "bg-surface-hover text-muted hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Semua" : (actionLabels[f]?.label || f)}
                </button>
              ))}
            </div>
          </div>
          {/* Search by email */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              placeholder="Cari berdasarkan email user..."
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary"
            />
            {emailSearch && (
              <button
                onClick={() => setEmailSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Search by detail + quick filters */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              placeholder='Cari di detail (mis. refunded":true, orderId, server)...'
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary"
            />
            {detailSearch && (
              <button
                onClick={() => setDetailSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {[
              { label: "Refund berhasil", value: '"refunded":true' },
              { label: "Refund gagal", value: '"refunded":false' },
            ].map((q) => (
              <button
                key={q.value}
                onClick={() => setDetailSearch(detailSearch === q.value ? "" : q.value)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  detailSearch === q.value ? "bg-primary text-background" : "bg-surface-hover text-muted hover:text-foreground"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada log aktivitas</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">Waktu</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Aksi</th>
                      <th className="pb-3 font-medium hidden md:table-cell">Detail</th>
                      <th className="pb-3 font-medium hidden lg:table-cell">IP</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs sm:text-sm">
                    {logs.map((log) => {
                      const actionInfo = actionLabels[log.action] || { label: log.action, variant: "default" as const };
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-surface/30">
                          <td className="py-2 sm:py-3 text-muted whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("id-ID", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="py-2 sm:py-3">
                            <div className="font-medium">{log.userName || "—"}</div>
                            <div className="text-[10px] text-muted">{log.userEmail}</div>
                          </td>
                          <td className="py-2 sm:py-3">
                            <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                          </td>
                          <td className="py-2 sm:py-3 text-muted text-xs max-w-[200px] truncate hidden md:table-cell">
                            {log.detail || "—"}
                          </td>
                          <td className="py-2 sm:py-3 text-muted font-[family-name:var(--font-jetbrains-mono)] text-xs hidden lg:table-cell">
                            {log.ip || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted">Hal {page}/{totalPages}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
