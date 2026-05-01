"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Globe,
  Tag,
  DollarSign,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  Plus,
  RefreshCw,
  Pencil,
} from "lucide-react";

interface Country {
  id_negara: number;
  nama_negara: string;
}

interface ServiceOption {
  code: string;
  name: string;
  costUsd: number;
  stockHeroSms: number;
  suggestedIdr: number;
}

interface StockEntry {
  id: string;
  countryId: number;
  countryName: string;
  serviceCode: string;     // kode asli (e.g. "wa")
  storedCode: string;      // composite (e.g. "wa#abc")
  serviceName: string;
  price: number;
  stock: number;
  maxPriceUsd: number | null;
}

export default function Api4StockPage() {
  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [entries, setEntries] = useState<StockEntry[]>([]);

  // Loading states
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [priceIdr, setPriceIdr] = useState<string>("");
  const [maxPriceUsd, setMaxPriceUsd] = useState<string>("");
  const [stock, setStock] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode

  // Auto-sync: harga IDR otomatis ngikut perubahan maxPriceUsd
  const [autoSync, setAutoSync] = useState(true);
  const [meta, setMeta] = useState<{ kurs: number; markup: number } | null>(null);

  // Search states
  const [countrySearch, setCountrySearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [entrySearch, setEntrySearch] = useState("");

  // Feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-clear feedback
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
    return () => clearTimeout(t);
  }, [error, success]);

  // Fetch countries + meta (kurs & markup) sekali di awal load
  useEffect(() => {
    (async () => {
      try {
        const [countriesRes, metaRes] = await Promise.all([
          fetch("/api/admin/api4-stock/herosms?type=countries"),
          fetch("/api/admin/api4-stock/herosms?type=meta"),
        ]);
        const countriesData = await countriesRes.json();
        if (countriesData?.data) setCountries(countriesData.data);
        const metaData = await metaRes.json();
        if (metaData?.data) setMeta(metaData.data);
      } catch {
        setError("Gagal memuat daftar negara dari HeroSMS");
      } finally {
        setLoadingCountries(false);
      }
    })();
  }, []);

  // Fetch existing entries
  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch("/api/admin/api4-stock");
      const data = await res.json();
      if (data?.data) setEntries(data.data);
    } catch {
      setError("Gagal memuat data stock");
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Fetch services when country selected
  useEffect(() => {
    if (!selectedCountry) {
      setServices([]);
      return;
    }
    setSelectedService(null);
    setLoadingServices(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/api4-stock/herosms?type=services&country=${selectedCountry.id_negara}`
        );
        const data = await res.json();
        if (data?.data) setServices(data.data);
      } catch {
        setError("Gagal memuat layanan untuk negara ini");
      } finally {
        setLoadingServices(false);
      }
    })();
  }, [selectedCountry]);

  // Auto-fill price + maxPrice when service selected
  useEffect(() => {
    if (!selectedService) return;
    setPriceIdr(String(selectedService.suggestedIdr));
    setMaxPriceUsd(selectedService.costUsd.toFixed(4));
    setStock(String(Math.min(selectedService.stockHeroSms, 100)));
  }, [selectedService]);

  const filteredCountries = countries.filter((c) =>
    c.nama_negara.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredEntries = entries.filter(
    (e) =>
      e.serviceName.toLowerCase().includes(entrySearch.toLowerCase()) ||
      e.countryName.toLowerCase().includes(entrySearch.toLowerCase()) ||
      e.serviceCode.toLowerCase().includes(entrySearch.toLowerCase())
  );

  async function handleSave() {
    if (!selectedCountry || !selectedService) {
      setError("Pilih negara & layanan dulu");
      return;
    }
    const priceNum = Number(priceIdr);
    const stockNum = Number(stock);
    const maxPriceNum = maxPriceUsd ? Number(maxPriceUsd) : null;

    if (!priceNum || priceNum <= 0) {
      setError("Harga IDR harus > 0");
      return;
    }
    if (stockNum < 0 || isNaN(stockNum)) {
      setError("Stock harus ≥ 0");
      return;
    }
    if (maxPriceNum !== null && (isNaN(maxPriceNum) || maxPriceNum <= 0)) {
      setError("maxPrice USD harus > 0 atau kosong");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/api4-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId, // kalau ada → update, kalau null → create new
          countryId: selectedCountry.id_negara,
          countryName: selectedCountry.nama_negara,
          serviceCode: selectedService.code,
          serviceName: selectedService.name,
          price: priceNum,
          stock: stockNum,
          maxPriceUsd: maxPriceNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal menyimpan");
        return;
      }
      setSuccess(
        editingId
          ? `Berhasil update: ${selectedService.name} @ ${selectedCountry.nama_negara}`
          : `Berhasil tambah: ${selectedService.name} @ ${selectedCountry.nama_negara} (Rp ${priceNum.toLocaleString("id-ID")})`
      );
      cancelEdit();
      loadEntries();
    } catch {
      setError("Gagal menyimpan entry");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: StockEntry) {
    // Cari country & service di list yang udah loaded
    const country = countries.find((c) => c.id_negara === entry.countryId);
    if (country) setSelectedCountry(country);
    setSelectedService({
      code: entry.serviceCode,
      name: entry.serviceName,
      costUsd: entry.maxPriceUsd ?? 0,
      stockHeroSms: 0,
      suggestedIdr: entry.price,
    });
    setPriceIdr(String(entry.price));
    setMaxPriceUsd(entry.maxPriceUsd !== null ? String(entry.maxPriceUsd) : "");
    setStock(String(entry.stock));
    setEditingId(entry.id);
    // Scroll ke atas biar form keliatan
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setSelectedService(null);
    setPriceIdr("");
    setMaxPriceUsd("");
    setStock("");
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus entry "${name}"?`)) return;
    try {
      const res = await fetch("/api/admin/api4-stock", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal menghapus");
        return;
      }
      setSuccess("Entry dihapus");
      loadEntries();
    } catch {
      setError("Gagal menghapus");
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Neptune Stock Manual
          </h1>
          <p className="text-sm text-muted mt-1">
            Atur manual harga, maxPrice, dan stock untuk server Neptune (api4 / HeroSMS V2)
          </p>
        </div>
        <Button variant="ghost" onClick={loadEntries} disabled={loadingEntries}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingEntries ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 text-error text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 text-success text-sm">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* LEFT: Form tambah/edit */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  {editingId ? "Edit Entry" : "Tambah Entry Baru"}
                </span>
                {editingId && (
                  <button
                    onClick={cancelEdit}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Batal Edit
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Country selector */}
              <div>
                <label className="text-xs text-muted block mb-2">
                  <Globe className="w-3 h-3 inline mr-1" />
                  1. Pilih Negara (dari HeroSMS)
                </label>
                {loadingCountries ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading {countries.length} negara...
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                      <input
                        type="text"
                        placeholder="Cari negara..."
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                      {filteredCountries.slice(0, 50).map((c) => (
                        <button
                          key={c.id_negara}
                          onClick={() => setSelectedCountry(c)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                            selectedCountry?.id_negara === c.id_negara
                              ? "bg-primary/10 text-primary font-medium"
                              : ""
                          }`}
                        >
                          <span className="text-muted text-xs">#{c.id_negara}</span>{" "}
                          {c.nama_negara}
                        </button>
                      ))}
                      {filteredCountries.length > 50 && (
                        <div className="px-3 py-2 text-xs text-muted">
                          ...dan {filteredCountries.length - 50} lainnya — pakai pencarian
                        </div>
                      )}
                    </div>
                    {selectedCountry && (
                      <div className="mt-2 text-xs text-success">
                        ✓ Terpilih: <strong>{selectedCountry.nama_negara}</strong> (ID {selectedCountry.id_negara})
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Service selector */}
              {selectedCountry && (
                <div>
                  <label className="text-xs text-muted block mb-2">
                    <Tag className="w-3 h-3 inline mr-1" />
                    2. Pilih Layanan (dari HeroSMS)
                  </label>
                  {loadingServices ? (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading layanan...
                    </div>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input
                          type="text"
                          placeholder="Cari layanan (wa, telegram, ig, ...)"
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                        {filteredServices.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted">Tidak ada layanan</div>
                        )}
                        {filteredServices.slice(0, 50).map((s) => (
                          <button
                            key={s.code}
                            onClick={() => setSelectedService(s)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                              selectedService?.code === s.code
                                ? "bg-primary/10 text-primary font-medium"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                <span className="text-muted text-xs">{s.code}</span> · {s.name}
                              </span>
                              <span className="text-xs text-muted shrink-0">
                                ${s.costUsd.toFixed(4)} · {s.stockHeroSms}stk
                              </span>
                            </div>
                          </button>
                        ))}
                        {filteredServices.length > 50 && (
                          <div className="px-3 py-2 text-xs text-muted">
                            ...dan {filteredServices.length - 50} lainnya
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Form fields */}
              {selectedService && (
                <>
                  <div className="p-3 bg-primary/5 rounded-lg text-xs space-y-1">
                    <div>HeroSMS USD: <strong>${selectedService.costUsd.toFixed(4)}</strong></div>
                    <div>Saran IDR (markup 1.15): <strong>Rp {selectedService.suggestedIdr.toLocaleString("id-ID")}</strong></div>
                    <div>Stok HeroSMS realtime: <strong>{selectedService.stockHeroSms.toLocaleString("id-ID")}</strong></div>
                  </div>

                  <div>
                    <label className="text-xs text-muted block mb-1">
                      <DollarSign className="w-3 h-3 inline mr-1" />
                      3. Harga Jual ke User (IDR) — wajib
                    </label>
                    <Input
                      type="number"
                      placeholder="Contoh: 3500"
                      value={priceIdr}
                      onChange={(e) => setPriceIdr(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-muted">
                        4. maxPrice USD — dikirim ke HeroSMS getNumberV2 (kosong = auto pakai listing)
                      </label>
                      {meta && (
                        <label className="text-xs text-muted flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSync}
                            onChange={(e) => setAutoSync(e.target.checked)}
                            className="w-3 h-3 cursor-pointer"
                          />
                          Auto-sync harga
                        </label>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="Contoh: 0.16"
                      value={maxPriceUsd}
                      onChange={(e) => {
                        const newMax = e.target.value;
                        setMaxPriceUsd(newMax);
                        // Auto-recalc harga IDR sesuai markup kalau auto-sync aktif
                        if (autoSync && meta) {
                          const num = Number(newMax);
                          if (!isNaN(num) && num > 0) {
                            const newIdr = Math.ceil(num * meta.kurs * meta.markup);
                            setPriceIdr(String(newIdr));
                          }
                        }
                      }}
                    />
                    {autoSync && meta && (
                      <p className="text-[10px] text-muted mt-1">
                        Auto: harga IDR = maxPrice × kurs ({meta.kurs.toLocaleString("id-ID", { maximumFractionDigits: 0 })}) × markup ({meta.markup})
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted block mb-1">
                      5. Stock Manual — wajib (decrement otomatis tiap order sukses)
                    </label>
                    <Input
                      type="number"
                      placeholder="Contoh: 100"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                    />
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> {editingId ? "Update Entry" : "Tambah Entry"}</>
                    )}
                  </Button>
                  {!editingId && (
                    <p className="text-xs text-muted text-center">
                      Tip: bisa tambah banyak entry untuk service+negara yang sama dengan harga berbeda. User akan liat semua sebagai opsi.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: List existing */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Entries Aktif ({entries.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Cari negara/layanan..."
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary/50"
                />
              </div>

              {loadingEntries ? (
                <div className="flex items-center justify-center py-8 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted">
                  {entries.length === 0
                    ? "Belum ada entry. Tambah satu di kiri."
                    : "Tidak ada entry yang cocok."}
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-lg border border-border bg-background/50 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {e.serviceName}{" "}
                            <span className="text-xs text-muted">({e.serviceCode})</span>
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            🌍 {e.countryName} (ID {e.countryId})
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                            <div>
                              <div className="text-muted">Harga</div>
                              <div className="font-medium">
                                Rp {e.price.toLocaleString("id-ID")}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted">maxPrice</div>
                              <div className="font-medium">
                                {e.maxPriceUsd !== null
                                  ? `$${e.maxPriceUsd.toFixed(4)}`
                                  : <span className="text-muted">auto</span>}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted">Stock</div>
                              <div className={`font-medium ${e.stock === 0 ? "text-error" : "text-success"}`}>
                                {e.stock}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(e)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id, `${e.serviceName} @ ${e.countryName} (Rp ${e.price.toLocaleString("id-ID")})`)}
                            className="p-1.5 rounded-lg hover:bg-error/10 text-error transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
