"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Trash2,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle,
  Tag,
  RotateCcw,
  Search,
  Globe,
} from "lucide-react";

interface PriceRule {
  id: string;
  serviceCode: string;
  countryId: number;
  priceType: string;
  value: number;
  active: boolean;
}

interface Negara {
  id_negara: number;
  nama_negara: string;
}

interface LayananItem {
  code: string;
  name: string;
  price: number;
  stock: number;
}

const priceTypeOptions = [
  { value: "", label: "Harga Provider" },
  { value: "fixed", label: "Harga Tetap" },
  { value: "multiply", label: "Kalikan (%)" },
  { value: "markup", label: "Tambahan (+)" },
];

export default function PricingPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Server & negara selection
  const [selectedServer, setSelectedServer] = useState("api1");
  const [selectedCountryId, setSelectedCountryId] = useState(0);
  const [negaraList, setNegaraList] = useState<Negara[]>([]);
  const [negaraSearch, setNegaraSearch] = useState("");
  const [loadingNegara, setLoadingNegara] = useState(true);

  // Layanan list for selected country
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [loadingLayanan, setLoadingLayanan] = useState(false);
  const [layananSearch, setLayananSearch] = useState("");

  // Inline edit: track which service is being edited
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editValue, setEditValue] = useState(0);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  // Fetch negara
  useEffect(() => {
    async function fetchNegara() {
      setLoadingNegara(true);
      try {
        const res = await fetch(`/api/otp/negara?server=${selectedServer}`);
        const data = await res.json();
        if (data.data) {
          const sorted = [...data.data].sort((a: Negara, b: Negara) =>
            a.nama_negara.localeCompare(b.nama_negara)
          );
          setNegaraList(sorted);
        }
      } catch { /* silent */ }
      finally { setLoadingNegara(false); }
    }
    fetchNegara();
  }, [selectedServer]);

  // Fetch rules
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

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // Fetch layanan when country selected
  useEffect(() => {
    if (selectedCountryId === 0) {
      setLayananList([]);
      return;
    }
    async function fetchLayanan() {
      setLoadingLayanan(true);
      try {
        const res = await fetch(`/api/otp/layanan?server=${selectedServer}&negara=${selectedCountryId}`);
        const data = await res.json();
        const key = String(selectedCountryId);
        let serviceData: Record<string, { layanan: string; harga?: number; stok?: number }> = {};
        if (data?.[key]) serviceData = data[key];
        else if (data?.data?.[key]) serviceData = data.data[key];

        const mapped: LayananItem[] = Object.entries(serviceData)
          .filter(([, v]) => v && typeof v === "object" && "layanan" in v)
          .map(([code, v]) => ({
            code,
            name: v.layanan || code,
            price: v.harga || 0,
            stock: v.stok || 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setLayananList(mapped);
      } catch { setLayananList([]); }
      finally { setLoadingLayanan(false); }
    }
    fetchLayanan();
  }, [selectedCountryId, selectedServer]);

  // Auto-hide notifications
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); }
  }, [error]);

  // Find existing rule for a service+country combo
  const getRule = (serviceCode: string): PriceRule | undefined => {
    return rules.find(
      (r) => r.serviceCode === serviceCode && r.countryId === selectedCountryId
    );
  };

  // Get global/wildcard rule
  const getGlobalRule = (): PriceRule | undefined => {
    return rules.find((r) => r.serviceCode === "*" && r.countryId === selectedCountryId)
      || rules.find((r) => r.serviceCode === "*" && r.countryId === 0);
  };

  const startEdit = (code: string) => {
    const rule = getRule(code);
    setEditingCode(code);
    if (rule) {
      setEditType(rule.priceType);
      setEditValue(rule.value);
    } else {
      setEditType("fixed");
      setEditValue(0);
    }
  };

  const cancelEdit = () => { setEditingCode(null); };

  const saveServicePrice = async (code: string) => {
    setSavingCode(code);
    setError("");
    try {
      // Kalau type kosong = hapus rule (kembali ke harga provider)
      if (!editType) {
        const rule = getRule(code);
        if (rule) {
          const res = await fetch("/api/admin/pricing", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: rule.id }),
          });
          if (res.ok) {
            setSuccess(`${code.toUpperCase()} kembali ke harga provider`);
            fetchRules();
          }
        }
        setEditingCode(null);
        setSavingCode(null);
        return;
      }

      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode: code,
          countryId: selectedCountryId,
          priceType: editType,
          value: editValue,
        }),
      });
      if (res.ok) {
        setSuccess(`Harga ${code.toUpperCase()} disimpan`);
        setEditingCode(null);
        fetchRules();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch {
      setError("Gagal menyimpan");
    } finally {
      setSavingCode(null);
    }
  };

  const handleDeleteRule = async (id: string, code: string) => {
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSuccess(`${code.toUpperCase()} kembali ke harga provider`);
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
    } catch { setError("Gagal mereset"); }
    finally { setResetting(false); }
  };

  const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  const getSellingPrice = (basePrice: number, rule?: PriceRule) => {
    if (!rule) return basePrice;
    switch (rule.priceType) {
      case "fixed": return rule.value;
      case "multiply": return Math.ceil((basePrice * rule.value) / 100);
      case "markup": return basePrice + rule.value;
      default: return basePrice;
    }
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const filteredLayanan = layananList.filter(
    (l) => l.name.toLowerCase().includes(layananSearch.toLowerCase())
      || l.code.toLowerCase().includes(layananSearch.toLowerCase())
  );

  const filteredNegara = negaraList.filter(
    (n) => n.nama_negara.toLowerCase().includes(negaraSearch.toLowerCase())
  );

  const selectedNegaraName = selectedCountryId === 0
    ? ""
    : capitalize(negaraList.find((n) => n.id_negara === selectedCountryId)?.nama_negara || "");

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
          <p className="text-sm text-muted">Pilih negara untuk lihat dan atur harga per layanan.</p>
        </div>
        {rules.length > 0 && (
          <Button variant="danger" size="sm" onClick={handleResetAll} disabled={resetting}>
            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reset Semua ({rules.length})
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Penjelasan */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted space-y-1">
              <p><strong className="text-foreground">Harga Tetap</strong>: Abaikan harga provider, pakai harga ini</p>
              <p><strong className="text-foreground">Kalikan (%)</strong>: Harga provider × persentase (150 = 1.5x)</p>
              <p><strong className="text-foreground">Tambahan (+)</strong>: Harga provider + nominal Rupiah</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Pilih Server + Negara */}
        <div className="lg:col-span-1 space-y-4">
          {/* Server */}
          <Card>
            <CardContent>
              <label className="text-xs text-muted block mb-2">Server</label>
              <div className="flex gap-2">
                {[
                  { id: "api1", name: "Mars", icon: "🔴" },
                  { id: "api2", name: "Jupiter", icon: "🟠" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedServer(s.id); setSelectedCountryId(0); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      selectedServer === s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span>{s.icon}</span> {s.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Negara List */}
          <Card>
            <CardContent>
              <label className="text-xs text-muted block mb-2">
                <Globe className="w-3 h-3 inline mr-1" />
                Pilih Negara
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Cari negara..."
                  value={negaraSearch}
                  onChange={(e) => setNegaraSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                />
              </div>
              <div className="max-h-[500px] overflow-y-auto space-y-0.5">
                {loadingNegara ? (
                  <div className="py-8 text-center text-muted text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Memuat...
                  </div>
                ) : (
                  filteredNegara.map((n) => (
                    <button
                      key={n.id_negara}
                      onClick={() => { setSelectedCountryId(n.id_negara); setLayananSearch(""); setEditingCode(null); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCountryId === n.id_negara
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-surface-hover"
                      }`}
                    >
                      {capitalize(n.nama_negara)}
                      <span className="text-xs text-muted ml-1.5">#{n.id_negara}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main: Daftar Layanan + Harga */}
        <div className="lg:col-span-3">
          {selectedCountryId === 0 ? (
            <Card>
              <CardContent>
                <div className="text-center py-16 text-muted">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Pilih negara di sebelah kiri</p>
                  <p className="text-sm mt-1">Semua layanan yang tersedia akan muncul di sini</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Layanan di {selectedNegaraName}
                    {layananList.length > 0 && <Badge variant="primary">{layananList.length}</Badge>}
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input
                      type="text"
                      placeholder="Cari layanan..."
                      value={layananSearch}
                      onChange={(e) => setLayananSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLayanan ? (
                  <div className="py-12 text-center text-muted">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />Memuat layanan...
                  </div>
                ) : filteredLayanan.length === 0 ? (
                  <div className="py-12 text-center text-muted">
                    <p>Tidak ada layanan ditemukan</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted border-b border-border">
                          <th className="pb-3 font-medium">Kode</th>
                          <th className="pb-3 font-medium">Layanan</th>
                          <th className="pb-3 font-medium">Stok</th>
                          <th className="pb-3 font-medium">Harga Provider</th>
                          <th className="pb-3 font-medium">Tipe</th>
                          <th className="pb-3 font-medium">Nilai</th>
                          <th className="pb-3 font-medium">Harga Jual</th>
                          <th className="pb-3 font-medium text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredLayanan.map((l) => {
                          const rule = getRule(l.code);
                          const globalRule = getGlobalRule();
                          const activeRule = rule || globalRule;
                          const sellingPrice = getSellingPrice(l.price, activeRule);
                          const isEditing = editingCode === l.code;
                          const hasCustomRule = !!rule;
                          const profit = sellingPrice - l.price;

                          return (
                            <tr
                              key={l.code}
                              className={`border-b border-border/50 transition-colors ${
                                isEditing ? "bg-primary/5" : "hover:bg-surface/30 cursor-pointer"
                              }`}
                              onClick={() => !isEditing && startEdit(l.code)}
                            >
                              <td className="py-2.5">
                                <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold text-xs">
                                  {l.code.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="font-medium">{capitalize(l.name)}</span>
                              </td>
                              <td className="py-2.5">
                                <span className={`text-xs font-[family-name:var(--font-jetbrains-mono)] ${
                                  l.stock > 100 ? "text-success" : l.stock > 20 ? "text-accent" : "text-error"
                                }`}>
                                  {l.stock}
                                </span>
                              </td>
                              <td className="py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted">
                                {formatRp(l.price)}
                              </td>
                              <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                                {isEditing ? (
                                  <select
                                    value={editType}
                                    onChange={(e) => {
                                      setEditType(e.target.value);
                                      if (e.target.value === "fixed" && editValue === 0) setEditValue(l.price);
                                    }}
                                    className="w-full h-8 px-2 rounded-lg bg-surface border border-border text-xs focus:outline-none focus:border-primary/50 text-foreground"
                                  >
                                    {priceTypeOptions.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                ) : hasCustomRule ? (
                                  <Badge variant="warning" className="text-[10px]">
                                    {rule.priceType === "fixed" ? "Tetap" : rule.priceType === "multiply" ? "×%" : "+Rp"}
                                  </Badge>
                                ) : globalRule ? (
                                  <Badge variant="default" className="text-[10px]">Global</Badge>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                                {isEditing && editType ? (
                                  <Input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(Number(e.target.value))}
                                    className="h-8 text-xs font-[family-name:var(--font-jetbrains-mono)] w-24"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveServicePrice(l.code);
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                  />
                                ) : hasCustomRule ? (
                                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
                                    {rule.priceType === "fixed" ? formatRp(rule.value) : rule.priceType === "multiply" ? `${rule.value}%` : `+${formatRp(rule.value)}`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-[family-name:var(--font-jetbrains-mono)] font-bold text-xs ${
                                    hasCustomRule ? "text-primary" : ""
                                  }`}>
                                    {formatRp(sellingPrice)}
                                  </span>
                                  {profit > 0 && (
                                    <span className="text-[10px] text-success">+{formatRp(profit)}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="sm" onClick={() => saveServicePrice(l.code)} disabled={savingCode === l.code}>
                                      {savingCode === l.code ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    </Button>
                                    <button onClick={cancelEdit} className="p-1.5 text-muted hover:text-foreground">
                                      ✕
                                    </button>
                                  </div>
                                ) : hasCustomRule ? (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleDeleteRule(rule.id, l.code)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                ) : null}
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
          )}
        </div>
      </div>
    </div>
  );
}
