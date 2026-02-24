"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Trash2,
  Loader2,
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

interface CrossCountryItem {
  countryId: number;
  countryName: string;
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

  // Cross-country search
  const [globalServiceSearch, setGlobalServiceSearch] = useState("");
  const [crossCountryResults, setCrossCountryResults] = useState<CrossCountryItem[]>([]);
  const [loadingCrossSearch, setLoadingCrossSearch] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline edit
  const [editingKey, setEditingKey] = useState<string | null>(null); // "code" or "code:countryId"
  const [editType, setEditType] = useState("");
  const [editValue, setEditValue] = useState(0);
  const [editCountryId, setEditCountryId] = useState(0); // for cross-country mode
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cross-country search: cari layanan di semua negara
  const doCrossCountrySearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCrossCountryResults([]);
      return;
    }
    setLoadingCrossSearch(true);
    const results: CrossCountryItem[] = [];

    // Fetch dari semua negara secara paralel (batch 10)
    const countries = negaraList.slice(); // copy
    const batchSize = 10;

    for (let i = 0; i < countries.length; i += batchSize) {
      const batch = countries.slice(i, i + batchSize);
      const promises = batch.map(async (n) => {
        try {
          const res = await fetch(`/api/otp/layanan?server=${selectedServer}&negara=${n.id_negara}`);
          const data = await res.json();
          const key = String(n.id_negara);
          let serviceData: Record<string, { layanan: string; harga?: number; stok?: number }> = {};
          if (data?.[key]) serviceData = data[key];
          else if (data?.data?.[key]) serviceData = data.data[key];

          for (const [code, v] of Object.entries(serviceData)) {
            if (!v || typeof v !== "object" || !("layanan" in v)) continue;
            const name = (v.layanan || code).toLowerCase();
            const q = query.toLowerCase();
            if (name.includes(q) || code.toLowerCase().includes(q)) {
              results.push({
                countryId: n.id_negara,
                countryName: n.nama_negara,
                code,
                name: v.layanan || code,
                price: v.harga || 0,
                stock: v.stok || 0,
              });
            }
          }
        } catch { /* skip failed country */ }
      });
      await Promise.all(promises);
    }

    results.sort((a, b) => a.countryName.localeCompare(b.countryName) || a.code.localeCompare(b.code));
    setCrossCountryResults(results);
    setLoadingCrossSearch(false);
  }, [negaraList, selectedServer]);

  // Debounced cross-country search trigger
  useEffect(() => {
    if (selectedCountryId !== 0 || !globalServiceSearch) {
      setCrossCountryResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      doCrossCountrySearch(globalServiceSearch);
    }, 600);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [globalServiceSearch, selectedCountryId, doCrossCountrySearch]);

  // Auto-hide notifications
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t); }
  }, [error]);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  // Find rule for service+country
  const getRuleFor = (serviceCode: string, countryId: number): PriceRule | undefined => {
    return rules.find((r) => r.serviceCode === serviceCode && r.countryId === countryId);
  };

  const getGlobalRuleFor = (countryId: number): PriceRule | undefined => {
    return rules.find((r) => r.serviceCode === "*" && r.countryId === countryId)
      || rules.find((r) => r.serviceCode === "*" && r.countryId === 0);
  };

  const getSellingPrice = (basePrice: number, rule?: PriceRule) => {
    if (!rule) return basePrice;
    switch (rule.priceType) {
      case "fixed": return rule.value;
      case "multiply": return Math.ceil((basePrice * rule.value) / 100);
      case "markup": return basePrice + rule.value;
      default: return basePrice;
    }
  };

  // Edit helpers — support both modes
  const startEdit = (code: string, countryId: number) => {
    const key = `${code}:${countryId}`;
    const rule = getRuleFor(code, countryId);
    setEditingKey(key);
    setEditCountryId(countryId);
    if (rule) {
      setEditType(rule.priceType);
      setEditValue(rule.value);
    } else {
      setEditType("fixed");
      setEditValue(0);
    }
  };

  const cancelEdit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEditingKey(null);
  };

  const autoSave = async (code: string, countryId: number, type: string, val: number) => {
    const key = `${code}:${countryId}`;
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCode: code, countryId, priceType: type, value: val }),
      });
      if (res.ok) {
        setSuccess(`${code.toUpperCase()} tersimpan`);
        fetchRules();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch { setError("Gagal menyimpan"); }
    finally { setSavingKey(null); }
  };

  const triggerAutoSave = useCallback((code: string, countryId: number, type: string, val: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (type && val > 0) autoSave(code, countryId, type, val);
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteRule = async (id: string, code: string) => {
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setSuccess(`${code.toUpperCase()} dihapus`); fetchRules(); }
    } catch { setError("Gagal menghapus"); }
  };

  const handleResetAll = async () => {
    if (!confirm("Reset SEMUA aturan harga?")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (res.ok) { const d = await res.json(); setSuccess(`${d.deleted} aturan dihapus`); fetchRules(); }
    } catch { setError("Gagal mereset"); }
    finally { setResetting(false); }
  };

  // Render a service row (reused for both modes)
  const renderRow = (code: string, name: string, price: number, stock: number, countryId: number, countryName?: string) => {
    const key = `${code}:${countryId}`;
    const rule = getRuleFor(code, countryId);
    const globalRule = getGlobalRuleFor(countryId);
    const activeRule = rule || globalRule;
    const sellingPrice = getSellingPrice(price, activeRule);
    const isEditing = editingKey === key;
    const hasCustomRule = !!rule;
    const profit = sellingPrice - price;

    return (
      <tr
        key={key}
        className={`border-b border-border/50 transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-surface/30 cursor-pointer"}`}
        onClick={() => !isEditing && startEdit(code, countryId)}
      >
        <td className="py-2.5">
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold text-xs">
            {code.toUpperCase()}
          </span>
        </td>
        <td className="py-2.5">
          <span className="font-medium text-sm">{capitalize(name)}</span>
        </td>
        {countryName !== undefined && (
          <td className="py-2.5 text-sm text-muted">{capitalize(countryName)}</td>
        )}
        <td className="py-2.5">
          <span className={`text-xs font-[family-name:var(--font-jetbrains-mono)] ${stock > 100 ? "text-success" : stock > 20 ? "text-accent" : "text-error"}`}>
            {stock}
          </span>
        </td>
        <td className="py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted">
          {formatRp(price)}
        </td>
        <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <select
              value={editType}
              onChange={(e) => {
                const t = e.target.value;
                setEditType(t);
                const v = t === "fixed" && editValue === 0 ? price : editValue;
                if (t === "fixed" && editValue === 0) setEditValue(v);
                if (t && v > 0) triggerAutoSave(code, countryId, t, v);
              }}
              className="w-full h-8 px-2 rounded-lg bg-surface border border-border text-xs focus:outline-none focus:border-primary/50 text-foreground"
            >
              {priceTypeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
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
            <div className="relative">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEditValue(v);
                  triggerAutoSave(code, countryId, editType, v);
                }}
                className="h-8 text-xs font-[family-name:var(--font-jetbrains-mono)] w-28 pr-7"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                onBlur={() => {
                  if (editType && editValue > 0) {
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    autoSave(code, countryId, editType, editValue);
                  }
                  setTimeout(() => setEditingKey(null), 200);
                }}
              />
              {savingKey === key && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-primary" />}
            </div>
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
            <span className={`font-[family-name:var(--font-jetbrains-mono)] font-bold text-xs ${hasCustomRule ? "text-primary" : ""}`}>
              {formatRp(sellingPrice)}
            </span>
            {profit > 0 && <span className="text-[10px] text-success">+{formatRp(profit)}</span>}
          </div>
        </td>
        <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
          {hasCustomRule ? (
            <Button size="sm" variant="danger" onClick={() => handleDeleteRule(rule.id, code)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          ) : savingKey === key ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary inline" />
          ) : null}
        </td>
      </tr>
    );
  };

  // Filtered data
  const filteredLayanan = layananList.filter(
    (l) => l.name.toLowerCase().includes(layananSearch.toLowerCase())
      || l.code.toLowerCase().includes(layananSearch.toLowerCase())
  );
  const filteredNegara = negaraList.filter(
    (n) => n.nama_negara.toLowerCase().includes(negaraSearch.toLowerCase())
  );
  const selectedNegaraName = selectedCountryId === 0
    ? "" : capitalize(negaraList.find((n) => n.id_negara === selectedCountryId)?.nama_negara || "");

  // Is cross-country search mode?
  const isCrossSearch = selectedCountryId === 0 && globalServiceSearch.length >= 2;

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
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">Pengaturan Harga OTP</h1>
          <p className="text-sm text-muted">Pilih negara atau cari layanan untuk atur harga.</p>
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
        {/* Sidebar */}
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
                    onClick={() => { setSelectedServer(s.id); setSelectedCountryId(0); setGlobalServiceSearch(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      selectedServer === s.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span>{s.icon}</span> {s.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cari Layanan Global */}
          <Card>
            <CardContent>
              <label className="text-xs text-muted block mb-2">
                <Search className="w-3 h-3 inline mr-1" />
                Cari Layanan (Semua Negara)
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Ketik nama layanan..."
                  value={globalServiceSearch}
                  onChange={(e) => {
                    setGlobalServiceSearch(e.target.value);
                    if (e.target.value) setSelectedCountryId(0);
                  }}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                />
              </div>
              {globalServiceSearch && (
                <p className="text-[10px] text-muted mt-1.5">Min. 2 karakter. Cari di semua negara server {selectedServer === "api1" ? "Mars" : "Jupiter"}.</p>
              )}
            </CardContent>
          </Card>

          {/* Negara List */}
          <Card>
            <CardContent>
              <label className="text-xs text-muted block mb-2">
                <Globe className="w-3 h-3 inline mr-1" />
                Atau Pilih Negara
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
              <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                {loadingNegara ? (
                  <div className="py-8 text-center text-muted text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Memuat...
                  </div>
                ) : (
                  filteredNegara.map((n) => (
                    <button
                      key={n.id_negara}
                      onClick={() => { setSelectedCountryId(n.id_negara); setLayananSearch(""); setEditingKey(null); setGlobalServiceSearch(""); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCountryId === n.id_negara ? "bg-primary/10 text-primary font-medium" : "hover:bg-surface-hover"
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

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Mode 1: Cross-country search results */}
          {isCrossSearch ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="w-4 h-4 text-primary" />
                  Hasil pencarian &quot;{globalServiceSearch}&quot;
                  {!loadingCrossSearch && crossCountryResults.length > 0 && (
                    <Badge variant="primary">{crossCountryResults.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCrossSearch ? (
                  <div className="py-12 text-center text-muted">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />Mencari di semua negara...
                  </div>
                ) : crossCountryResults.length === 0 ? (
                  <div className="py-12 text-center text-muted">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>Tidak ditemukan layanan &quot;{globalServiceSearch}&quot;</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted border-b border-border">
                          <th className="pb-3 font-medium">Kode</th>
                          <th className="pb-3 font-medium">Layanan</th>
                          <th className="pb-3 font-medium">Negara</th>
                          <th className="pb-3 font-medium">Stok</th>
                          <th className="pb-3 font-medium">Harga Provider</th>
                          <th className="pb-3 font-medium">Tipe</th>
                          <th className="pb-3 font-medium">Nilai</th>
                          <th className="pb-3 font-medium">Harga Jual</th>
                          <th className="pb-3 font-medium text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {crossCountryResults.map((item) =>
                          renderRow(item.code, item.name, item.price, item.stock, item.countryId, item.countryName)
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : selectedCountryId === 0 ? (
            /* Mode 0: Empty state */
            <Card>
              <CardContent>
                <div className="text-center py-16 text-muted">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Pilih negara atau cari layanan</p>
                  <p className="text-sm mt-1">Pilih negara di kiri untuk lihat semua layanan, atau cari nama layanan untuk lihat di semua negara</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Mode 2: Country-specific layanan list */
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
                  <div className="py-12 text-center text-muted"><p>Tidak ada layanan ditemukan</p></div>
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
                        {filteredLayanan.map((l) =>
                          renderRow(l.code, l.name, l.price, l.stock, selectedCountryId)
                        )}
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
