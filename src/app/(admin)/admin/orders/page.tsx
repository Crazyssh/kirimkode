"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingCart,
  Radio,
  RotateCcw,
  AlertCircle,
  X,
  CheckCircle,
} from "lucide-react";

import { toast } from "sonner";

interface OrderItem {
  id: string;
  service: string;
  country: string;
  number: string;
  code: string | null;
  status: string;
  price: number;
  server: string;
  source: string;
  userEmail: string;
  time: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusFilters = [
  { label: "Semua", value: "all" },
  { label: "Waiting", value: "waiting" },
  { label: "Success", value: "success" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Timeout", value: "timeout" },
  { label: "Refunded", value: "refunded" },
];

const SERVER_LABELS: Record<string, { name: string; icon: string }> = {
  api1: { name: "Mars", icon: "🔴" },
  api2: { name: "Jupiter", icon: "🟠" },
  api3: { name: "Saturn", icon: "🟣" },
  api4: { name: "Neptune", icon: "🔵" },
  api5: { name: "Earth", icon: "🌍" },
  api6: { name: "Venus", icon: "🪐" },
  api7: { name: "Mars V2", icon: "🔴" },
  api8: { name: "Mercury", icon: "☿️" },
  api9: { name: "Uranus", icon: "🌌" },
  api10: { name: "Eris", icon: "✨" },
  bot: { name: "Bot", icon: "🤖" },
};

function getServerLabel(id: string): { name: string; icon: string } {
  return SERVER_LABELS[id] || { name: id, icon: "⚪" };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Refund modal state
  const [refundOrder, setRefundOrder] = useState<OrderItem | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  // Refs untuk avoid stale closure di setInterval
  const liveModeRef = useRef(liveMode);
  const paginationRef = useRef(pagination);
  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);
  useEffect(() => { paginationRef.current = pagination; }, [pagination]);

  // Initial / manual fetch — show loading spinner
  const fetchOrders = useCallback(
    async (page = 1, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (search) params.set("search", search);

        const res = await fetch(`/api/admin/orders?${params}`);
        if (res.ok) {
          const json = await res.json();
          setOrders(json.data);
          setPagination(json.pagination);
          setLastUpdate(new Date());
        }
      } catch {
        // silent
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [statusFilter, search]
  );

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  // Auto-refresh tiap 5 detik kalau live mode aktif & masih di page 1
  // (page 2+ pause karena admin lagi navigate, jangan disturb)
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      if (!liveModeRef.current) return;
      // Hanya silent refresh kalau di page 1 (tidak ganggu navigasi)
      if (paginationRef.current.page !== 1) return;
      fetchOrders(1, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [liveMode, fetchOrders]);

  // Handler refund
  const handleRefund = async () => {
    if (!refundOrder) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${refundOrder.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Refund gagal");
        return;
      }

      toast.success(
        `Refund Rp ${refundOrder.price.toLocaleString("id-ID")} ke ${json.data.user.email}`,
        {
          description: `Saldo baru: Rp ${json.data.user.newBalance.toLocaleString("id-ID")}`,
        }
      );

      // Update order in current list (optimistic)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === refundOrder.id ? { ...o, status: "refunded" } : o
        )
      );

      // Close modal
      setRefundOrder(null);
      setRefundReason("");

      // Silent refresh untuk dapat data terbaru
      fetchOrders(pagination.page, true);
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setRefunding(false);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Manajemen Orders
          </h1>
          <p className="text-sm text-muted">
            Semua order pembelian nomor OTP
            {liveMode && pagination.page === 1 && (
              <span className="inline-flex items-center gap-1 ml-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                <span className="text-success text-xs font-medium">Live</span>
              </span>
            )}
            {liveMode && pagination.page !== 1 && (
              <span className="ml-2 text-xs text-muted">
                Live paused (page {pagination.page})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted hidden sm:block font-[family-name:var(--font-jetbrains-mono)]">
              {lastUpdate.toLocaleTimeString("id-ID")}
            </span>
          )}
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
              liveMode
                ? "border-success bg-success/10 text-success"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
            title="Toggle live update tiap 5 detik"
          >
            <Radio className={`w-4 h-4 ${liveMode ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">Live {liveMode ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="Cari layanan, nomor, nama, atau email..."
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
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === sf.value
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
                      <th className="pb-3 font-medium">Layanan</th>
                      <th className="pb-3 font-medium">Server</th>
                      <th className="pb-3 font-medium">Negara</th>
                      <th className="pb-3 font-medium">Nomor</th>
                      <th className="pb-3 font-medium">Kode OTP</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Harga</th>
                      <th className="pb-3 font-medium">Source</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Waktu</th>
                      <th className="pb-3 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {orders.map((order) => {
                      const srv = getServerLabel(order.server);
                      return (
                      <tr
                        key={order.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 font-medium">{order.service}</td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-hover/50 text-xs">
                            <span>{srv.icon}</span>
                            <span>{srv.name}</span>
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted">
                          {order.country}
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {order.number}
                        </td>
                        <td className="py-3">
                          {order.code ? (
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold text-xs">
                              {order.code}
                            </span>
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
                                  : order.status === "refunded"
                                    ? "primary"
                                    : "error"
                            }
                          >
                            {order.status === "success"
                              ? "Berhasil"
                              : order.status === "waiting"
                                ? "Menunggu"
                                : order.status === "cancelled"
                                  ? "Dibatalkan"
                                  : order.status === "timeout"
                                    ? "Time Out"
                                    : order.status === "refunded"
                                      ? "Refunded"
                                      : "Gagal"}
                          </Badge>
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(order.price)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide ${
                              order.source === "api"
                                ? "bg-accent/15 text-accent border border-accent/30"
                                : order.source === "bot"
                                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                  : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                            title={
                              order.source === "api"
                                ? "Order via API key (developer)"
                                : order.source === "bot"
                                  ? "Order via Telegram Bot"
                                  : "Order via Website"
                            }
                          >
                            {order.source === "api" ? "API" : order.source === "bot" ? "Bot" : "Web"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted max-w-[140px] truncate">
                          {order.userEmail}
                        </td>
                        <td className="py-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(order.time)}
                        </td>
                        <td className="py-3 text-right">
                          {order.status !== "refunded" && order.price > 0 && (
                            <button
                              onClick={() => {
                                setRefundOrder(order);
                                setRefundReason("");
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-warning/40 text-warning hover:bg-warning/10 transition-colors"
                              title="Refund ke saldo user"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Refund
                            </button>
                          )}
                          {order.status === "refunded" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                              <CheckCircle className="w-3 h-3 text-primary" />
                              Refunded
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && (
                <div className="text-center py-12 text-muted">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada order ditemukan</p>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted">
                  Menampilkan {orders.length} dari {pagination.total} order
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchOrders(pagination.page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted">
                    Halaman {pagination.page} dari{" "}
                    {pagination.totalPages || 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchOrders(pagination.page + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Refund */}
      {refundOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            if (refunding) return;
            setRefundOrder(null);
            setRefundReason("");
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (refunding) return;
                setRefundOrder(null);
                setRefundReason("");
              }}
              disabled={refunding}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
                    Refund Order
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Saldo user akan dikredit kembali sesuai harga order.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface/50 p-3 space-y-1.5 text-xs mb-4">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Layanan</span>
                  <span className="font-medium text-right truncate max-w-[60%]">
                    {refundOrder.service}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Negara</span>
                  <span className="font-medium">{refundOrder.country}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">Nomor</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">
                    {refundOrder.number}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted">User</span>
                  <span className="text-right truncate max-w-[60%]">
                    {refundOrder.userEmail}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1.5 mt-1.5 border-t border-border">
                  <span className="text-muted">Jumlah Refund</span>
                  <span className="font-bold text-success font-[family-name:var(--font-jetbrains-mono)]">
                    {formatRupiah(refundOrder.price)}
                  </span>
                </div>
              </div>

              <label className="block text-xs font-medium text-muted mb-1.5">
                Alasan (opsional)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Misal: OTP salah, request user, goodwill..."
                maxLength={500}
                rows={3}
                disabled={refunding}
                className="w-full rounded-xl border border-border bg-surface/50 px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none disabled:opacity-50"
              />
              <p className="text-[10px] text-muted/70 mt-1 text-right">
                {refundReason.length}/500
              </p>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setRefundOrder(null);
                    setRefundReason("");
                  }}
                  disabled={refunding}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 bg-warning text-background hover:bg-warning/90"
                  onClick={handleRefund}
                  disabled={refunding}
                >
                  {refunding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Konfirmasi Refund
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
