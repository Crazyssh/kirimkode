"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  Plus,
  Trash2,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";

interface VoucherUsage {
  id: string;
  ip: string | null;
  isp: string | null;
  bonus: number;
  createdAt: string;
  user: { name: string | null; email: string | null };
}

interface Voucher {
  id: string;
  code: string;
  description: string;
  bonusType: string;
  bonusValue: number;
  maxBonus: number;
  minDeposit: number;
  maxUsage: number;
  maxPerUser: number;
  firstDeposit: boolean;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  _count: { usages: number };
  usages: VoucherUsage[];
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [bonusType, setBonusType] = useState("fixed");
  const [bonusValue, setBonusValue] = useState(5000);
  const [maxBonus, setMaxBonus] = useState(0);
  const [minDeposit, setMinDeposit] = useState(0);
  const [maxUsage, setMaxUsage] = useState(0);
  const [maxPerUser, setMaxPerUser] = useState(1);
  const [firstDeposit, setFirstDeposit] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const fetchVouchers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/vouchers");
      if (res.ok) {
        const json = await res.json();
        setVouchers(json.data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const handleSave = async () => {
    if (!code || !description) { setError("Kode dan deskripsi wajib diisi"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, description, bonusType, bonusValue, maxBonus, minDeposit, maxUsage, maxPerUser, firstDeposit, expiresAt: expiresAt || null }),
      });
      if (res.ok) {
        setSuccess("Voucher berhasil dibuat!");
        setCode(""); setDescription(""); setBonusValue(5000);
        fetchVouchers();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal membuat voucher");
      }
    } catch { setError("Gagal membuat voucher"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus voucher ini?")) return;
    try {
      await fetch("/api/admin/vouchers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchVouchers();
    } catch { /* silent */ }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // Group IPs to detect duplicates
  const getIpCounts = (usages: VoucherUsage[]) => {
    const counts: Record<string, number> = {};
    for (const u of usages) {
      const ip = u.ip || "unknown";
      counts[ip] = (counts[ip] || 0) + 1;
    }
    return counts;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Kelola Voucher
        </h1>
        <p className="text-sm text-muted">Buat dan kelola voucher bonus deposit untuk user</p>
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

      {/* Form Buat Voucher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-primary" />
            Buat Voucher Baru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Kode Voucher</label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DEPOSIT10K" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Deskripsi</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bonus deposit pertama" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Tipe Bonus</label>
              <select value={bonusType} onChange={(e) => setBonusType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none text-foreground">
                <option value="fixed">Bonus Tetap (IDR)</option>
                <option value="percent">Persentase (%)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Nilai Bonus</label>
              <Input type="number" value={bonusValue} onChange={(e) => setBonusValue(Number(e.target.value))} placeholder="5000" />
              <p className="text-[10px] text-muted mt-0.5">{bonusType === "fixed" ? "Dalam Rupiah" : "Persentase dari deposit"}</p>
            </div>
            {bonusType === "percent" && (
              <div>
                <label className="text-xs text-muted block mb-1">Max Bonus (IDR)</label>
                <Input type="number" value={maxBonus} onChange={(e) => setMaxBonus(Number(e.target.value))} placeholder="0 = unlimited" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Min Deposit</label>
              <Input type="number" value={minDeposit} onChange={(e) => setMinDeposit(Number(e.target.value))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Max Penggunaan</label>
              <Input type="number" value={maxUsage} onChange={(e) => setMaxUsage(Number(e.target.value))} placeholder="0 = unlimited" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Max Per User</label>
              <Input type="number" value={maxPerUser} onChange={(e) => setMaxPerUser(Number(e.target.value))} placeholder="1" />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Kadaluarsa</label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="firstDeposit" checked={firstDeposit} onChange={(e) => setFirstDeposit(e.target.checked)} className="rounded accent-primary" />
            <label htmlFor="firstDeposit" className="text-sm text-muted">Hanya untuk deposit pertama</label>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Buat Voucher
          </Button>
        </CardContent>
      </Card>

      {/* Daftar Voucher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="w-4 h-4 text-primary" />
            Daftar Voucher
            {vouchers.length > 0 && <Badge variant="primary">{vouchers.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada voucher</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vouchers.map((v) => {
                const expired = v.expiresAt && new Date() > new Date(v.expiresAt);
                const isExpanded = expandedId === v.id;
                const ipCounts = getIpCounts(v.usages);
                const uniqueIps = Object.keys(ipCounts).length;

                return (
                  <div key={v.id} className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Voucher Row */}
                    <div
                      className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-surface/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      <button className="text-muted shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-6 gap-1 sm:gap-4 items-center text-xs sm:text-sm">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold truncate">
                          {v.code}
                        </span>
                        <span className="text-muted truncate hidden sm:block">{v.description}</span>
                        <span className="font-bold">
                          {v.bonusType === "fixed"
                            ? `Rp ${v.bonusValue.toLocaleString("id-ID")}`
                            : `${v.bonusValue}%`}
                          {v.firstDeposit && <Badge variant="warning" className="ml-1 text-[8px]">1st</Badge>}
                        </span>
                        <span>{v._count.usages}/{v.maxUsage || "∞"}</span>
                        <span className="text-muted text-xs hidden sm:block">
                          {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString("id-ID") : "—"}
                        </span>
                        <Badge variant={expired ? "error" : v.active ? "success" : "error"}>
                          {expired ? "Expired" : v.active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Expanded Usage Detail */}
                    {isExpanded && (
                      <div className="border-t border-border/30 bg-background/30 px-4 py-3">
                        {v.usages.length === 0 ? (
                          <p className="text-sm text-muted text-center py-4">Belum ada yang pakai voucher ini</p>
                        ) : (
                          <>
                            {/* IP Summary */}
                            <div className="flex items-center gap-2 mb-3 text-xs text-muted">
                              <Globe className="w-3.5 h-3.5" />
                              <span>{v.usages.length} usage dari {uniqueIps} IP unik</span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left text-xs text-muted border-b border-border/50">
                                    <th className="pb-2 font-medium">User</th>
                                    <th className="pb-2 font-medium">Email</th>
                                    <th className="pb-2 font-medium">IP Address</th>
                                    <th className="pb-2 font-medium">ISP</th>
                                    <th className="pb-2 font-medium">Bonus</th>
                                    <th className="pb-2 font-medium">Waktu</th>
                                  </tr>
                                </thead>
                                <tbody className="text-xs">
                                  {v.usages.map((u) => {
                                    const ip = u.ip || "unknown";
                                    const isDuplicateIp = ipCounts[ip] > 1;
                                    return (
                                      <tr key={u.id} className="border-b border-border/30 hover:bg-surface/20 transition-colors">
                                        <td className="py-2 font-medium">{u.user.name || "-"}</td>
                                        <td className="py-2 text-muted max-w-[150px] truncate">{u.user.email || "-"}</td>
                                        <td className="py-2">
                                          <span className={`font-[family-name:var(--font-jetbrains-mono)] px-1.5 py-0.5 rounded ${
                                            isDuplicateIp
                                              ? "bg-error/10 text-error"
                                              : "bg-surface text-foreground"
                                          }`}>
                                            {ip}
                                          </span>
                                          {isDuplicateIp && (
                                            <Badge variant="error" className="ml-1 text-[8px]">DUP</Badge>
                                          )}
                                        </td>
                                        <td className="py-2">
                                          {u.isp ? (
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                              u.isp === "unknown"
                                                ? "bg-warning/10 text-warning"
                                                : "bg-success/10 text-success"
                                            }`}>
                                              {u.isp}
                                            </span>
                                          ) : (
                                            <span className="text-muted">—</span>
                                          )}
                                        </td>
                                        <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-primary">
                                          Rp {u.bonus.toLocaleString("id-ID")}
                                        </td>
                                        <td className="py-2 text-muted">{formatDate(u.createdAt)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
