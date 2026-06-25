"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface Row {
  id: string;
  email: string;
  name: string | null;
  balance: number;
  deposit: number;
  bonus: number;
  belanja: number;
  seharusnya: number;
  selisih: number;
}

interface Summary {
  count: number;
  totalMinus: number;
  totalPlus: number;
}

const filters = [
  { value: "minus", label: "Saldo Kurang (−)" },
  { value: "plus", label: "Saldo Lebih (+)" },
  { value: "all", label: "Semua Tidak Cocok" },
];

export default function ReconcilePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("minus");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reconcile?filter=${filter}&limit=300`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data);
        setSummary(json.summary);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Rekonsiliasi Saldo
        </h1>
        <p className="text-sm text-muted">
          Bandingkan saldo aktual vs seharusnya (deposit + bonus − belanja). Selisih minus = saldo user hilang.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <div className="text-lg font-bold">{summary.count}</div>
            <div className="text-xs text-muted">User Tidak Cocok</div>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <div className="text-lg font-bold text-error flex items-center justify-center gap-1">
              <TrendingDown className="w-4 h-4" />
              {formatRupiah(Math.abs(summary.totalMinus))}
            </div>
            <div className="text-xs text-muted">Total Saldo Kurang</div>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <div className="text-lg font-bold text-success flex items-center justify-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {formatRupiah(summary.totalPlus)}
            </div>
            <div className="text-xs text-muted">Total Saldo Lebih</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="w-4 h-4 text-primary" />
              Daftar Selisih
            </CardTitle>
            <div className="flex gap-1.5 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    filter === f.value ? "bg-primary text-background" : "bg-surface-hover text-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Semua saldo cocok. Tidak ada selisih.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium text-right">Saldo</th>
                    <th className="pb-3 font-medium text-right hidden md:table-cell">Deposit</th>
                    <th className="pb-3 font-medium text-right hidden md:table-cell">Bonus</th>
                    <th className="pb-3 font-medium text-right hidden lg:table-cell">Belanja</th>
                    <th className="pb-3 font-medium text-right">Seharusnya</th>
                    <th className="pb-3 font-medium text-right">Selisih</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-surface/30">
                      <td className="py-2 sm:py-3">
                        <Link href={`/admin/users/${r.id}`} className="hover:text-primary">
                          <div className="font-medium">{r.name || "—"}</div>
                          <div className="text-[10px] text-muted">{r.email}</div>
                        </Link>
                      </td>
                      <td className="py-2 sm:py-3 text-right font-medium">{formatRupiah(r.balance)}</td>
                      <td className="py-2 sm:py-3 text-right text-muted hidden md:table-cell">{formatRupiah(r.deposit)}</td>
                      <td className="py-2 sm:py-3 text-right text-muted hidden md:table-cell">{formatRupiah(r.bonus)}</td>
                      <td className="py-2 sm:py-3 text-right text-muted hidden lg:table-cell">{formatRupiah(r.belanja)}</td>
                      <td className="py-2 sm:py-3 text-right text-muted">{formatRupiah(r.seharusnya)}</td>
                      <td className={`py-2 sm:py-3 text-right font-bold ${r.selisih < 0 ? "text-error" : "text-success"}`}>
                        {r.selisih > 0 ? "+" : ""}{formatRupiah(r.selisih)}
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
