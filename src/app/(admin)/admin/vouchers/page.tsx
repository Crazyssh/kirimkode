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
} from "lucide-react";

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
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Kode</th>
                    <th className="pb-2 font-medium">Deskripsi</th>
                    <th className="pb-2 font-medium">Bonus</th>
                    <th className="pb-2 font-medium">Dipakai</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Kadaluarsa</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {vouchers.map((v) => {
                    const expired = v.expiresAt && new Date() > new Date(v.expiresAt);
                    return (
                      <tr key={v.id} className="border-b border-border/50">
                        <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">{v.code}</td>
                        <td className="py-2 text-muted max-w-[150px] truncate">{v.description}</td>
                        <td className="py-2 font-bold">
                          {v.bonusType === "fixed"
                            ? `Rp ${v.bonusValue.toLocaleString("id-ID")}`
                            : `${v.bonusValue}%`}
                          {v.firstDeposit && <Badge variant="warning" className="ml-1 text-[8px]">1st</Badge>}
                        </td>
                        <td className="py-2">{v._count.usages}/{v.maxUsage || "∞"}</td>
                        <td className="py-2 text-muted text-xs hidden sm:table-cell">
                          {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString("id-ID") : "—"}
                        </td>
                        <td className="py-2">
                          <Badge variant={expired ? "error" : v.active ? "success" : "error"}>
                            {expired ? "Expired" : v.active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Button variant="danger" size="sm" onClick={() => handleDelete(v.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
