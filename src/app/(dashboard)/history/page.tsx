"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
import {
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
} from "lucide-react";

interface WaCheckData {
  exists: boolean;
  profilePic?: string | null;
}

interface TgCheckData {
  exists: boolean;
  username?: string | null;
  firstName?: string | null;
  lastSeen?: string | null;
  lastSeenLabel?: string | null;
  registeredAt?: string | null;
  deleted?: boolean;
}

interface OrderItem {
  id: string;
  service: string;
  country: string;
  number: string;
  code: string | null;
  status: string;
  price: number;
  date: string;
  server?: string;
  orderId?: number;
  waCheck?: WaCheckData | null;
  tgCheck?: TgCheckData | null;
  checkedAt?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { fetchUser } = useUserStore();
  const { t } = useLanguageStore();

  const statusFilters = [
    { label: t("common.all"), value: "all" },
    { label: t("status.order.success"), value: "success" },
    { label: t("status.order.waiting"), value: "waiting" },
    { label: t("status.order.cancelled"), value: "cancelled" },
    { label: t("status.order.timeout"), value: "timeout" },
  ];

  const handleCancel = async (order: OrderItem) => {
    if (!order.server || !order.orderId) return;
    if (!confirm(`Batalkan order ${order.service}? Saldo akan dikembalikan.`)) return;

    setCancelling(order.id);
    try {
      await fetch("/api/otp/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: order.server, id: order.orderId }),
      });
      fetchUser();
      fetchOrders(pagination.page);
    } catch {
      alert("Gagal membatalkan order");
    } finally {
      setCancelling(null);
    }
  };

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const totalSpent = orders
    .filter((o) => o.status === "success")
    .reduce((a, b) => a + b.price, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          {t("history.title")}
        </h1>
        <p className="text-sm text-muted">{t("history.desc")}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
              {pagination.total}
            </div>
            <div className="text-xs text-muted">{t("history.totalTransactions")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
              {formatRupiah(totalSpent)}
            </div>
            <div className="text-xs text-muted">{t("history.spending")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-success">
              {orders.length > 0
                ? Math.round((orders.filter((o) => o.status === "success").length / orders.length) * 100)
                : 0}%
            </div>
            <div className="text-xs text-muted">{t("history.successRate")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder={t("history.searchPlaceholder")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {statusFilters.map((sf) => (
                <button
                  key={sf.value}
                  onClick={() => setStatusFilter(sf.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    statusFilter === sf.value
                      ? "bg-primary text-background"
                      : "bg-surface-hover text-muted hover:text-foreground"
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">{t("history.service")}</th>
                      <th className="pb-3 font-medium">{t("history.country")}</th>
                      <th className="pb-3 font-medium">{t("history.number")}</th>
                      <th className="pb-3 font-medium">{t("history.otpCode")}</th>
                      <th className="pb-3 font-medium">{t("history.status")}</th>
                      <th className="pb-3 font-medium">{t("history.price")}</th>
                      <th className="pb-3 font-medium">{t("history.date")}</th>
                      <th className="pb-3 font-medium">{t("history.action")}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 font-medium">{order.service}</td>
                        <td className="py-3 text-muted text-xs">{order.country}</td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
                              {order.number}
                            </span>
                            {order.checkedAt && (
                              <div className="flex flex-wrap gap-1">
                                {order.waCheck != null && (
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                    order.waCheck.exists
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-zinc-500/20 text-zinc-400"
                                  }`}>
                                    {order.waCheck.exists ? t("status.checker.waRegistered") : t("status.checker.waNotRegistered")}
                                  </span>
                                )}
                                {order.tgCheck != null && (
                                  <>
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                      order.tgCheck.exists && !order.tgCheck.deleted
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "bg-zinc-500/20 text-zinc-400"
                                    }`}>
                                      {order.tgCheck.exists && !order.tgCheck.deleted ? t("status.checker.tgRegistered") : t("status.checker.tgNotRegistered")}
                                    </span>
                                    {order.tgCheck.exists && !order.tgCheck.deleted && order.tgCheck.lastSeenLabel && (
                                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-400">
                                        {order.tgCheck.lastSeenLabel}
                                      </span>
                                    )}
                                    {order.tgCheck.exists && !order.tgCheck.deleted && order.tgCheck.registeredAt && (
                                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/20 text-cyan-400">
                                        {order.tgCheck.registeredAt}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          {order.code ? (
                            <div className="flex items-center gap-2">
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">
                                {order.code}
                              </span>
                              <button
                                className="text-muted hover:text-foreground"
                                onClick={() => navigator.clipboard.writeText(order.code!)}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              order.status === "success"
                                ? "success"
                                : order.status === "waiting"
                                ? "warning"
                                : "error"
                            }
                          >
                            {order.status === "success"
                              ? t("status.order.success")
                              : order.status === "waiting"
                              ? t("status.order.waiting")
                              : order.status === "cancelled"
                              ? t("status.order.cancelled")
                              : order.status === "timeout"
                              ? t("status.order.timeout")
                              : "Gagal"}
                          </Badge>
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(order.price)}
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {new Date(order.date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3">
                          {order.status === "waiting" && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancel(order)}
                              disabled={cancelling === order.id}
                            >
                              {cancelling === order.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              Batal
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && (
                <div className="text-center py-12 text-muted">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>{t("history.noTransactions")}</p>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted">
                  Menampilkan {orders.length} dari {pagination.total} transaksi
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchOrders(pagination.page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t("common.prev")}
                  </Button>
                  <span className="text-xs text-muted">
                    Halaman {pagination.page} dari {pagination.totalPages || 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchOrders(pagination.page + 1)}
                  >
                    {t("common.next")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
