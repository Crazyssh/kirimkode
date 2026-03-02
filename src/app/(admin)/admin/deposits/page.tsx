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
  Wallet,
  CheckCircle,
} from "lucide-react";

interface DepositItem {
  id: string;
  userEmail: string;
  amount: number;
  channel: string;
  trxId: string;
  status: string;
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
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Expired", value: "expired" },
];

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchDeposits = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (search) params.set("search", search);

        const res = await fetch(`/api/admin/deposits?${params}`);
        if (res.ok) {
          const json = await res.json();
          setDeposits(json.data);
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
    fetchDeposits(1);
  }, [fetchDeposits]);

  const handleConfirm = async (depositId: string) => {
    setConfirmingId(depositId);
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        fetchDeposits(pagination.page);
      } else {
        alert("Gagal mengkonfirmasi deposit.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setConfirmingId(null);
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
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Manajemen Deposits
        </h1>
        <p className="text-sm text-muted">Kelola semua deposit pengguna</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="Cari nama atau email user..."
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
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Jumlah</th>
                      <th className="pb-3 font-medium">Channel</th>
                      <th className="pb-3 font-medium">TRX ID</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Waktu</th>
                      <th className="pb-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {deposits.map((deposit) => (
                      <tr
                        key={deposit.id}
                        className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                      >
                        <td className="py-3 text-xs text-muted max-w-[140px] truncate">
                          {deposit.userEmail}
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium text-primary">
                          {formatRupiah(deposit.amount)}
                        </td>
                        <td className="py-3 text-xs">{deposit.channel}</td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted">
                          {deposit.trxId}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              deposit.status === "paid"
                                ? "success"
                                : deposit.status === "pending"
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {deposit.status === "paid"
                              ? "Lunas"
                              : deposit.status === "pending"
                                ? "Pending"
                                : "Expired"}
                          </Badge>
                        </td>
                        <td className="py-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(deposit.time)}
                        </td>
                        <td className="py-3">
                          {deposit.status === "pending" ? (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={confirmingId === deposit.id}
                              onClick={() => handleConfirm(deposit.id)}
                            >
                              {confirmingId === deposit.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Confirm
                            </Button>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {deposits.length === 0 && (
                <div className="text-center py-12 text-muted">
                  <Wallet className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada deposit ditemukan</p>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted">
                  Menampilkan {deposits.length} dari {pagination.total} deposit
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchDeposits(pagination.page - 1)}
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
                    onClick={() => fetchDeposits(pagination.page + 1)}
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
