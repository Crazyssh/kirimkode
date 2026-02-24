"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle,
  Tag,
  RotateCcw,
  Pencil,
  X,
} from "lucide-react";

interface PriceRule {
  id: string;
  serviceCode: string;
  countryId: number;
  priceType: string;
  value: number;
  active: boolean;
  createdAt: string;
}

interface Negara {
  id_negara: number;
  nama_negara: string;
}

const priceTypeOptions = [
  { value: "fixed", label: "Harga Tetap" },
  { value: "multiply", label: "Kalikan (%)" },
  { value: "markup", label: "Tambahan" },
];

const priceTypeLabels: Record<string, string> = {
  fixed: "Harga Tetap",
  multiply: "Kalikan (%)",
  markup: "Tambahan",
};

export default function PricingPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // ID yang sedang disave
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("fixed");
  const [editValue, setEditValue] = useState(0);

  // New rule inline
  const [showNewRow, setShowNewRow] = useState(false);
  const [newServiceCode, setNewServiceCode] = useState("*");
  const [newCountryId, setNewCountryId] = useState(0);
  const [newPriceType, setNewPriceType] = useState("fixed");
  const [newValue, setNewValue] = useState(1000);

  // Negara list for dropdown
  const [negaraList, setNegaraList] = useState<Negara[]>([]);

  useEffect(() => {
    async function fetchNegara() {
      try {
        const res = await fetch("/api/otp/negara?server=api1");
        const data = await res.json();
        if (data.data) {
          const sorted = [...data.data].sort((a: Negara, b: Negara) =>
            a.nama_negara.localeCompare(b.nama_negara)
          );
          setNegaraList(sorted);
        }
      } catch { /* silent */ }
    }
    fetchNegara();
  }, []);

  const getNegaraName = (id: number) => {
    if (id === 0) return "Semua";
    const n = negaraList.find((x) => x.id_negara === id);
    if (!n) return `#${id}`;
    return n.nama_negara.charAt(0).toUpperCase() + n.nama_negara.slice(1);
  };

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing");
      if (res.ok) {
        const json = await res.json();
        setRules(json.data);
      }
    } catch {
      setError("Gagal memuat aturan harga");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Auto-hide notifications
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const startEdit = (rule: PriceRule) => {
    setEditingId(rule.id);
    setEditType(rule.priceType);
    setEditValue(rule.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (rule: PriceRule) => {
    setSaving(rule.id);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode: rule.serviceCode,
          countryId: rule.countryId,
          priceType: editType,
          value: editValue,
        }),
      });
      if (res.ok) {
        setSuccess("Harga berhasil diupdate");
        setEditingId(null);
        fetchRules();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch {
      setError("Gagal menyimpan");
    } finally {
      setSaving(null);
    }
  };

  const saveNewRule = async () => {
    setSaving("new");
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode: newServiceCode,
          countryId: newCountryId,
          priceType: newPriceType,
          value: newValue,
        }),
      });
      if (res.ok) {
        setSuccess("Aturan harga baru ditambahkan");
        setShowNewRow(false);
        setNewServiceCode("*");
        setNewCountryId(0);
        setNewPriceType("fixed");
        setNewValue(1000);
        fetchRules();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch {
      setError("Gagal menyimpan");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus aturan harga ini?")) return;
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSuccess("Aturan dihapus");
        fetchRules();
      }
    } catch {
      setError("Gagal menghapus");
    }
  };

  const handleResetAll = async () => {
    if (!confirm("Reset SEMUA aturan harga? Harga kembali ke harga provider.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`${data.deleted} aturan dihapus`);
        fetchRules();
      }
    } catch {
      setError("Gagal mereset");
    } finally {
      setResetting(false);
    }
  };

  const formatValue = (rule: PriceRule) => {
    switch (rule.priceType) {
      case "fixed":
        return `Rp ${rule.value.toLocaleString("id-ID")}`;
      case "multiply":
        return `${rule.value}% (${(rule.value / 100).toFixed(1)}x)`;
      case "markup":
        return `+Rp ${rule.value.toLocaleString("id-ID")}`;
      default:
        return String(rule.value);
    }
  };

  const formatCountry = (id: number) => getNegaraName(id);
  const formatService = (code: string) => (code === "*" ? "Semua" : code.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Pengaturan Harga OTP
          </h1>
          <p className="text-sm text-muted">
            Klik baris untuk edit harga langsung. Kode <code className="text-primary">*</code> = semua layanan, negara <code className="text-primary">0</code> = semua negara.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setShowNewRow(true); setEditingId(null); }}>
            <Plus className="w-4 h-4" />
            Tambah
          </Button>
          {rules.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleResetAll} disabled={resetting}>
              {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Reset Semua
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Penjelasan Singkat */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted space-y-1">
              <p><strong className="text-foreground">Harga Tetap</strong>: Abaikan harga provider, pakai harga ini</p>
              <p><strong className="text-foreground">Kalikan (%)</strong>: Harga provider × persentase (150 = 1.5x)</p>
              <p><strong className="text-foreground">Tambahan</strong>: Harga provider + nominal Rupiah</p>
              <p className="text-xs">Aturan spesifik (per layanan/negara) lebih prioritas dari aturan global</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Aturan Harga — Inline Edit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-primary" />
            Aturan Harga
            {rules.length > 0 && <Badge variant="primary">{rules.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="pb-3 font-medium w-[140px]">Layanan</th>
                  <th className="pb-3 font-medium w-[100px]">Negara</th>
                  <th className="pb-3 font-medium w-[160px]">Tipe Harga</th>
                  <th className="pb-3 font-medium w-[160px]">Nilai</th>
                  <th className="pb-3 font-medium w-[80px]">Status</th>
                  <th className="pb-3 font-medium w-[120px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {/* New Rule Row */}
                {showNewRow && (
                  <tr className="border-b border-primary/30 bg-primary/5">
                    <td className="py-2 pr-2">
                      <Input
                        value={newServiceCode}
                        onChange={(e) => setNewServiceCode(e.target.value)}
                        placeholder="* atau kode"
                        className="h-9 text-sm font-[family-name:var(--font-jetbrains-mono)]"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={newCountryId}
                        onChange={(e) => setNewCountryId(Number(e.target.value))}
                        className="w-full h-9 px-2 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
                      >
                        <option value={0}>Semua Negara</option>
                        {negaraList.map((n) => (
                          <option key={n.id_negara} value={n.id_negara}>
                            {n.nama_negara.charAt(0).toUpperCase() + n.nama_negara.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={newPriceType}
                        onChange={(e) => setNewPriceType(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
                      >
                        {priceTypeOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <Input
                        type="number"
                        value={newValue}
                        onChange={(e) => setNewValue(Number(e.target.value))}
                        className="h-9 text-sm font-[family-name:var(--font-jetbrains-mono)]"
                      />
                    </td>
                    <td className="py-2">
                      <Badge variant="success">Baru</Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={saveNewRule} disabled={saving === "new"}>
                          {saving === "new" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowNewRow(false)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Existing Rules */}
                {rules.map((rule) => {
                  const isEditing = editingId === rule.id;

                  return (
                    <tr
                      key={rule.id}
                      className={`border-b border-border/50 transition-colors ${
                        isEditing ? "bg-primary/5" : "hover:bg-surface/30 cursor-pointer"
                      }`}
                      onClick={() => !isEditing && startEdit(rule)}
                    >
                      <td className="py-3">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">
                          {formatService(rule.serviceCode)}
                        </span>
                      </td>
                      <td className="py-3 text-muted">
                        {formatCountry(rule.countryId)}
                      </td>
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full h-9 px-2 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
                          >
                            {priceTypeOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="default">
                            {priceTypeLabels[rule.priceType] || rule.priceType}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            className="h-9 text-sm font-[family-name:var(--font-jetbrains-mono)]"
                            autoFocus
                          />
                        ) : (
                          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold">
                            {formatValue(rule)}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={rule.active ? "success" : "error"}>
                          {rule.active ? "Aktif" : "Off"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" onClick={() => saveEdit(rule)} disabled={saving === rule.id}>
                              {saving === rule.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleDelete(rule.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rules.length === 0 && !showNewRow && (
            <div className="text-center py-12 text-muted">
              <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Belum ada aturan harga</p>
              <p className="text-xs mt-1">Klik &quot;Tambah&quot; untuk buat aturan pertama</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contoh Perhitungan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contoh Perhitungan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-background/50">
              <div className="text-muted mb-2">Kalikan 150%</div>
              <div className="text-xs text-muted">Harga provider: Rp 1.000</div>
              <div className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                Jual: Rp 1.500
              </div>
              <div className="text-xs text-success">Profit: Rp 500/OTP</div>
            </div>
            <div className="p-4 rounded-xl bg-background/50">
              <div className="text-muted mb-2">Markup +Rp 1.000</div>
              <div className="text-xs text-muted">Harga provider: Rp 1.000</div>
              <div className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                Jual: Rp 2.000
              </div>
              <div className="text-xs text-success">Profit: Rp 1.000/OTP</div>
            </div>
            <div className="p-4 rounded-xl bg-background/50">
              <div className="text-muted mb-2">Harga Tetap Rp 3.000</div>
              <div className="text-xs text-muted">Harga provider: berapapun</div>
              <div className="text-lg font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                Jual: Rp 3.000
              </div>
              <div className="text-xs text-success">Profit: tergantung provider</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
