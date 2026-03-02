"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

interface OrderItem {
  id: string;
  service: string;
  country: string;
  number: string;
  code: string | null;
  status: string;
  price: number;
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
];

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

  const fetchOrders = useCallback(
    async (page = 1) => {
      setLoading(true);
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
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search]
  );

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

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
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Manajemen Orders
        </h1>
        <p className="text-sm text-muted">Semua order pembelian nomor OTP</p>
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
                      <th className="pb-3 font-medium">Negara</th>
                      <th className="pb-3 font-medium">Nomor</th>
                      <th className="pb-3 font-medium">Kode OTP</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Harga</th>
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 font-medium">{order.service}</td>
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
                                    : "Gagal"}
                          </Badge>
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {formatRupiah(order.price)}
                        </td>
                        <td className="py-3 text-xs text-muted max-w-[140px] truncate">
                          {order.userEmail}
                        </td>
                        <td className="py-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(order.time)}
                        </td>
                      </tr>
                    ))}
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
    </div>
  );
}
