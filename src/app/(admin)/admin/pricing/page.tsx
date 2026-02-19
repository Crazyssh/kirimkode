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
  Search,
  ChevronDown,
  RotateCcw,
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

interface LayananItem {
  code: string;
  name: string;
  price: number;
  stock: number;
}

const priceTypeLabels: Record<string, string> = {
  fixed: "Harga Tetap (IDR)",
  multiply: "Kalikan (%)",
  markup: "Tambahan (IDR)",
};

export default function PricingPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dropdown data
  const [negaraList, setNegaraList] = useState<Negara[]>([]);
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [loadingNegara, setLoadingNegara] = useState(true);
  const [loadingLayanan, setLoadingLayanan] = useState(false);

  // Dropdown open state
  const [showNegaraDropdown, setShowNegaraDropdown] = useState(false);
  const [showLayananDropdown, setShowLayananDropdown] = useState(false);
  const [negaraSearch, setNegaraSearch] = useState("");
  const [layananSearch, setLayananSearch] = useState("");

  // Form state
  const [selectedServer, setSelectedServer] = useState("api1");
  const [serviceCode, setServiceCode] = useState("*");
  const [serviceLabel, setServiceLabel] = useState("Semua Layanan");
  const [countryId, setCountryId] = useState(0);
  const [countryLabel, setCountryLabel] = useState("Semua Negara");
  const [priceType, setPriceType] = useState("multiply");
  const [value, setValue] = useState(150);

  // Fetch negara list when server changes
  useEffect(() => {
    async function fetchNegara() {
      setLoadingNegara(true);
      setNegaraList([]);
      setCountryId(0);
      setCountryLabel("Semua Negara");
      setServiceCode("*");
      setServiceLabel("Semua Layanan");
      try {
        const res = await fetch(`/api/otp/negara?server=${selectedServer}`);
        const data = await res.json();
        if (data.success !== false && data.data) {
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

  // Fetch layanan when a country is selected
  useEffect(() => {
    if (countryId === 0) {
      setLayananList([]);
      return;
    }
    async function fetchLayanan() {
      setLoadingLayanan(true);
      try {
        const res = await fetch(`/api/otp/layanan?server=${selectedServer}&negara=${countryId}`);
        const data = await res.json();
        const negaraKey = String(countryId);
        let serviceData: Record<string, { layanan: string }> = {};
        if (data?.[negaraKey]) serviceData = data[negaraKey];
        else if (data?.data?.[negaraKey]) serviceData = data.data[negaraKey];

        const mapped: LayananItem[] = Object.entries(serviceData)
          .filter(([, v]) => v && typeof v === "object" && "layanan" in v)
          .map(([code, v]) => {
            const item = v as { layanan: string; harga?: number; stok?: number };
            return { code, name: item.layanan, price: item.harga || 0, stock: item.stok || 0 };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setLayananList(mapped);
      } catch { setLayananList([]); }
      finally { setLoadingLayanan(false); }
    }
    fetchLayanan();
  }, [countryId, selectedServer]);

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

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCode, countryId, priceType, value }),
      });

      if (res.ok) {
        setSuccess("Aturan harga berhasil disimpan");
        fetchRules();
        // Reset form
        setServiceCode("*");
        setCountryId(0);
        setValue(150);
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan");
      }
    } catch {
      setError("Gagal menyimpan aturan harga");
    } finally {
      setSaving(false);
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
        setSuccess("Aturan harga dihapus");
        fetchRules();
      }
    } catch {
      setError("Gagal menghapus");
    }
  };

  const handleResetAll = async () => {
    if (!confirm("Reset SEMUA aturan harga? Semua markup/harga custom akan dihapus dan kembali ke harga asli provider.")) return;
    setResetting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`${data.deleted} aturan harga dihapus. Semua harga kembali ke harga provider.`);
        fetchRules();
      } else {
        setError("Gagal mereset aturan harga");
      }
    } catch {
      setError("Gagal mereset aturan harga");
    } finally {
      setResetting(false);
    }
  };

  const formatValue = (rule: PriceRule) => {
    switch (rule.priceType) {
      case "fixed":
        return `Rp ${rule.value.toLocaleString("id-ID")}`;
      case "multiply":
        return `${rule.value}% (${(rule.value / 100).toFixed(2)}x)`;
      case "markup":
        return `+Rp ${rule.value.toLocaleString("id-ID")}`;
      default:
        return String(rule.value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Pengaturan Harga OTP
        </h1>
        <p className="text-sm text-muted">
          Atur markup harga jual OTP. Harga dari provider bisa dinaikkan atau diturunkan.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Penjelasan */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted">
              <p className="font-medium text-foreground mb-1">Cara kerja:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Kalikan (%)</strong>: Harga provider x persentase. Contoh: provider Rp 1.000, set 200% = jual Rp 2.000</li>
                <li><strong>Tambahan (IDR)</strong>: Harga provider + nominal tetap. Contoh: provider Rp 1.000, tambah Rp 500 = jual Rp 1.500</li>
                <li><strong>Harga Tetap</strong>: Abaikan harga provider, pakai harga yang kamu tentukan</li>
                <li>Kode <code className="text-primary">*</code> = berlaku untuk semua layanan, negara <code className="text-primary">0</code> = semua negara</li>
                <li>Aturan spesifik (per layanan/negara) lebih diprioritaskan dari aturan global</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Tambah/Edit */}
      <Card className="relative z-10" style={{ overflow: "visible" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-4 h-4 text-primary" />
            Tambah Aturan Harga
          </CardTitle>
        </CardHeader>
        <CardContent style={{ overflow: "visible" }}>
          {/* Server Selector */}
          <div className="flex gap-2 mb-4">
            {[
              { id: "api1", name: "Mars", icon: "\uD83D\uDD34" },
              { id: "api2", name: "Jupiter", icon: "\uD83D\uDFE0" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedServer(s.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  selectedServer === s.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface hover:border-primary/30"
                }`}
              >
                <span>{s.icon}</span>
                {s.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" style={{ overflow: "visible" }}>
            {/* Negara Dropdown */}
            <div className="relative z-30">
              <label className="text-xs text-muted mb-1.5 block">Negara</label>
              <button
                onClick={() => { setShowNegaraDropdown(!showNegaraDropdown); setShowLayananDropdown(false); setNegaraSearch(""); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface border border-border text-sm hover:border-primary/50 transition-colors text-left"
              >
                <span className={countryId === 0 ? "text-primary font-medium" : ""}>{countryLabel}</span>
                <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              </button>
              {showNegaraDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-hidden">
                  <div className="sticky top-0 p-2 bg-surface border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                      <input
                        type="text"
                        placeholder="Cari negara..."
                        value={negaraSearch}
                        onChange={(e) => setNegaraSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setCountryId(0); setCountryLabel("Semua Negara"); setServiceCode("*"); setServiceLabel("Semua Layanan"); setShowNegaraDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${countryId === 0 ? "bg-primary/10 text-primary font-medium" : ""}`}
                    >
                      ✦ Semua Negara
                    </button>
                    {loadingNegara ? (
                      <div className="px-3 py-4 text-sm text-muted text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Memuat...</div>
                    ) : (
                      negaraList
                        .filter((n) => n.nama_negara.toLowerCase().includes(negaraSearch.toLowerCase()))
                        .map((n) => (
                          <button
                            key={n.id_negara}
                            onClick={() => { setCountryId(n.id_negara); setCountryLabel(n.nama_negara.charAt(0).toUpperCase() + n.nama_negara.slice(1)); setShowNegaraDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${countryId === n.id_negara ? "bg-primary/10 text-primary" : ""}`}
                          >
                            {n.nama_negara.charAt(0).toUpperCase() + n.nama_negara.slice(1)}
                            <span className="text-muted text-xs ml-2">#{n.id_negara}</span>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Layanan Dropdown */}
            <div className="relative z-20">
              <label className="text-xs text-muted mb-1.5 block">Layanan</label>
              <button
                onClick={() => { setShowLayananDropdown(!showLayananDropdown); setShowNegaraDropdown(false); setLayananSearch(""); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface border border-border text-sm hover:border-primary/50 transition-colors text-left"
              >
                <span className={serviceCode === "*" ? "text-primary font-medium" : ""}>{serviceLabel}</span>
                <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              </button>
              {showLayananDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-hidden">
                  <div className="sticky top-0 p-2 bg-surface border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                      <input
                        type="text"
                        placeholder="Cari layanan..."
                        value={layananSearch}
                        onChange={(e) => setLayananSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setServiceCode("*"); setServiceLabel("Semua Layanan"); setShowLayananDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${serviceCode === "*" ? "bg-primary/10 text-primary font-medium" : ""}`}
                    >
                      ✦ Semua Layanan
                    </button>
                    {countryId === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted text-center">Pilih negara dulu untuk melihat layanan</div>
                    ) : loadingLayanan ? (
                      <div className="px-3 py-4 text-sm text-muted text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Memuat...</div>
                    ) : layananList.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted text-center">Tidak ada layanan</div>
                    ) : (
                      layananList
                        .filter((l) => l.name.toLowerCase().includes(layananSearch.toLowerCase()) || l.code.toLowerCase().includes(layananSearch.toLowerCase()))
                        .map((l) => (
                          <button
                            key={l.code}
                            onClick={() => { setServiceCode(l.code); setServiceLabel(`${l.name.charAt(0).toUpperCase() + l.name.slice(1)} (${l.code})`); setShowLayananDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${serviceCode === l.code ? "bg-primary/10 text-primary" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                {l.name.charAt(0).toUpperCase() + l.name.slice(1)}
                                <span className="text-muted text-xs ml-1.5 font-[family-name:var(--font-jetbrains-mono)]">{l.code}</span>
                              </span>
                              <span className="flex items-center gap-2 text-xs shrink-0 ml-2">
                                <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary">Rp {l.price.toLocaleString("id-ID")}</span>
                                <span className={`${l.stock > 100 ? "text-success" : l.stock > 20 ? "text-accent" : "text-error"}`}>{l.stock} stok</span>
                              </span>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tipe Harga */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">Tipe Harga</label>
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
              >
                <option value="multiply">Kalikan (%)</option>
                <option value="markup">Tambahan (IDR)</option>
                <option value="fixed">Harga Tetap (IDR)</option>
              </select>
            </div>

            {/* Nilai */}
            <div>
              <label className="text-xs text-muted mb-1.5 block">Nilai</label>
              <Input
                type="number"
                placeholder={priceType === "multiply" ? "150" : "500"}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
              <p className="text-xs text-muted mt-1">
                {priceType === "multiply" ? "100 = 1x, 150 = 1.5x, 200 = 2x" : "Dalam Rupiah"}
              </p>
            </div>

            {/* Simpan */}
            <div className="flex items-end">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Simpan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daftar Aturan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4 text-primary" />
              Aturan Harga Aktif
              {rules.length > 0 && (
                <Badge variant="primary">{rules.length}</Badge>
              )}
            </CardTitle>
            {rules.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetAll}
                disabled={resetting}
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Reset Semua ke Harga Provider
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Belum ada aturan harga</p>
              <p className="text-xs mt-1">Harga akan menggunakan harga asli dari provider</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-3 font-medium">Layanan</th>
                    <th className="pb-3 font-medium">Negara</th>
                    <th className="pb-3 font-medium">Tipe</th>
                    <th className="pb-3 font-medium">Nilai</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-border/50 hover:bg-surface/30">
                      <td className="py-3">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">
                          {rule.serviceCode === "*" ? "Semua" : rule.serviceCode.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-muted">
                        {rule.countryId === 0
                          ? "Semua"
                          : negaraList.find((n) => n.id_negara === rule.countryId)?.nama_negara
                            ? (negaraList.find((n) => n.id_negara === rule.countryId)!.nama_negara.charAt(0).toUpperCase() + negaraList.find((n) => n.id_negara === rule.countryId)!.nama_negara.slice(1))
                            : `#${rule.countryId}`}
                      </td>
                      <td className="py-3">
                        <Badge variant="default">
                          {priceTypeLabels[rule.priceType] || rule.priceType}
                        </Badge>
                      </td>
                      <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] font-bold">
                        {formatValue(rule)}
                      </td>
                      <td className="py-3">
                        <Badge variant={rule.active ? "success" : "error"}>
                          {rule.active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
