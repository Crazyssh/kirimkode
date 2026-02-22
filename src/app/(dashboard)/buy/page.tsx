"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import { servers } from "@/data/services";
import type { OTPServer } from "@/data/services";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
import { playOtpSound } from "@/lib/sound";
import { toast } from "sonner";
import {
  Search,
  Globe,
  ChevronDown,
  Clock,
  Copy,
  XCircle,
  CheckCircle,
  ShoppingCart,
  Server,
  Loader2,
  AlertCircle,
  Download,
  Star,
} from "lucide-react";

interface ApiNegara {
  id_negara: number;
  nama_negara: string;
}

interface ApiLayananItem {
  harga: number;
  stok: number;
  layanan: string;
}

interface DisplayService {
  code: string;
  name: string;
  price: number;
  stock: number;
}

interface HistoryOrder {
  id: string;
  service: string;
  country: string;
  number: string;
  code: string | null;
  status: string;
  price: number;
  date: string;
  server?: string;
  orderId?: number;
}

export default function BuyPage() {
  const { user, fetchUser } = useUserStore();
  const { t } = useLanguageStore();
  const [selectedServer, setSelectedServer] = useState<OTPServer>(servers[0]);

  // Riwayat order state
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historySearch, setHistorySearch] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const [negaraList, setNegaraList] = useState<ApiNegara[]>([]);
  const [selectedNegara, setSelectedNegara] = useState<ApiNegara | null>(null);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState<DisplayService | null>(null);
  const [operatorList, setOperatorList] = useState<string[]>([]);
  const [selectedOperator, setSelectedOperator] = useState("any");
  const [serviceList, setServiceList] = useState<DisplayService[]>([]);
  const [loadingNegara, setLoadingNegara] = useState(false);
  const [loadingOperator, setLoadingOperator] = useState(false);
  const [loadingLayanan, setLoadingLayanan] = useState(false);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [bulkOrdering, setBulkOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const operatorDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (operatorDropdownRef.current && !operatorDropdownRef.current.contains(e.target as Node)) setShowOperatorDropdown(false);
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target as Node)) setShowServiceDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close country dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    if (showCountryDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCountryDropdown]);

  // Fetch negara list when server changes
  useEffect(() => {
    const fetchNegara = async () => {
      setLoadingNegara(true);
      setError(null);
      setServiceList([]);
      setSelectedNegara(null);
      try {
        const res = await fetch(`/api/otp/negara?server=${selectedServer.id}`);
        const data = await res.json();
        if (data.success && data.data) {
          const sorted = [...data.data].sort((a: ApiNegara, b: ApiNegara) =>
            a.nama_negara.localeCompare(b.nama_negara)
          );
          setNegaraList(sorted);
          if (sorted.length > 0) {
            setSelectedNegara(sorted[0]);
          }
        } else {
          setNegaraList([]);
        }
      } catch {
        setError("Gagal memuat daftar negara");
        setNegaraList([]);
      } finally {
        setLoadingNegara(false);
      }
    };
    fetchNegara();
  }, [selectedServer]);

  // Fetch operator list when negara changes
  useEffect(() => {
    if (!selectedNegara) return;
    const fetchOperator = async () => {
      setLoadingOperator(true);
      setSelectedOperator("any");
      try {
        const res = await fetch(
          `/api/otp/operator?server=${selectedServer.id}&negara=${selectedNegara.id_negara}`
        );
        const data = await res.json();
        const negaraKey = String(selectedNegara.id_negara);
        const ops: string[] = data.data?.[negaraKey] || [];
        setOperatorList(ops);
      } catch {
        setOperatorList(["any"]);
      } finally {
        setLoadingOperator(false);
      }
    };
    fetchOperator();
  }, [selectedNegara, selectedServer]);

  // Fetch layanan when negara changes
  useEffect(() => {
    if (!selectedNegara) return;

    const fetchLayanan = async () => {
      setLoadingLayanan(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/otp/layanan?server=${selectedServer.id}&negara=${selectedNegara.id_negara}`
        );
        const data = await res.json();

        // Try multiple response formats:
        // Format 1: { "6": { "wa": { harga, stok, layanan } } }
        // Format 2: { "data": { "6": { "wa": { ... } } } }
        // Format 3: { "success": true, "data": { "6": { ... } } }
        const negaraKey = String(selectedNegara.id_negara);
        let layananData: Record<string, ApiLayananItem> = {};

        if (data[negaraKey] && typeof data[negaraKey] === "object") {
          layananData = data[negaraKey];
        } else if (data.data?.[negaraKey] && typeof data.data[negaraKey] === "object") {
          layananData = data.data[negaraKey];
        } else {
          // Try finding first object key that contains service data
          const keys = Object.keys(data).filter(
            (k) => !["code", "success", "message", "data"].includes(k)
          );
          if (keys.length > 0 && typeof data[keys[0]] === "object") {
            layananData = data[keys[0]];
          }
        }

        const mapped: DisplayService[] = Object.entries(layananData)
          .filter(([, info]) => info && typeof info === "object" && "layanan" in (info as unknown as Record<string, unknown>))
          .map(([code, info]) => {
            const item = info as ApiLayananItem;
            return {
              code,
              name: item.layanan,
              price: item.harga,
              stock: item.stok,
            };
          });

        setServiceList(mapped);
      } catch {
        setError("Gagal memuat daftar layanan");
        setServiceList([]);
      } finally {
        setLoadingLayanan(false);
      }
    };
    fetchLayanan();
  }, [selectedNegara, selectedServer]);

  // Fetch riwayat order
  const fetchHistory = useCallback(async (page = 1, silent = false) => {
    if (!silent) setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(historyLimit) });
      if (historyFilter !== "all") params.set("status", historyFilter);
      if (historySearch.trim()) params.set("search", historySearch.trim());
      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryOrders(json.data);
        setHistoryPage(json.pagination.page);
        setHistoryTotal(json.pagination.total);
        setHistoryTotalPages(json.pagination.totalPages);
      }
    } catch { /* silent */ }
    finally { if (!silent) setHistoryLoading(false); }
  }, [historyFilter, historyLimit, historySearch]);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  // Poll OTP untuk semua order "waiting" di history + refresh tabel
  const otpPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const waitingOrders = historyOrders.filter(
      (o) => o.status === "waiting" && !o.code && o.server && o.orderId
    );

    if (waitingOrders.length === 0) return;

    otpPollRef.current = setInterval(async () => {
      let gotNewOtp = false;

      await Promise.all(
        waitingOrders.map(async (order) => {
          try {
            const res = await fetch(
              `/api/otp/sms?server=${order.server}&id=${order.orderId}`
            );
            const data = await res.json();
            const otp = data.success ? data.data?.otp : null;
            if (otp && typeof otp === "string" && !/^(menunggu|waiting|pending|processing)$/i.test(otp.trim())) {
              gotNewOtp = true;
            }
          } catch {
            // silently retry
          }
        })
      );

      if (gotNewOtp) {
        playOtpSound();
        toast.success(t("buy.otpReceived"), {
          description: "Kode OTP baru telah masuk. Cek tabel riwayat order.",
        });
      }
      // Always refresh history to pick up OTP updates from DB
      fetchHistory(historyPage, true);
    }, 5000);

    return () => {
      if (otpPollRef.current) clearInterval(otpPollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOrders, historyPage, fetchHistory]);

  const handleCancelOrder = async (order: HistoryOrder) => {
    if (!order.server || !order.orderId) return;
    setCancellingId(order.id);
    try {
      await fetch("/api/otp/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server: order.server, id: order.orderId }),
      });
      fetchUser();
      fetchHistory(historyPage);
    } catch { /* silent */ }
    finally { setCancellingId(null); }
  };

  const handleBuy = async (service: DisplayService) => {
    if (!selectedNegara) return;
    setOrdering(service.code);
    setError(null);

    try {
      const res = await fetch("/api/otp/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server: selectedServer.id,
          negara: selectedNegara.id_negara,
          layanan: service.code,
          operator: selectedOperator,
          serviceName: service.name,
          countryName: selectedNegara.nama_negara,
          price: service.price,
        }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        fetchUser();
        fetchHistory(1);
      } else {
        setError(data.message || data.error || "Gagal membuat pesanan");
      }
    } catch {
      setError("Gagal membuat pesanan. Coba lagi.");
    } finally {
      setOrdering(null);
    }
  };

  const handleBulkBuy = async (service: DisplayService, count = 5) => {
    if (!selectedNegara) return;
    setBulkOrdering(true);
    setError(null);
    let successCount = 0;
    let lastError = "";

    for (let i = 0; i < count; i++) {
      try {
        const res = await fetch("/api/otp/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            server: selectedServer.id,
            negara: selectedNegara.id_negara,
            layanan: service.code,
            operator: selectedOperator,
            serviceName: service.name,
            countryName: selectedNegara.nama_negara,
            price: service.price,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          successCount++;
        } else {
          lastError = data.message || data.error || "Gagal membuat pesanan";
          break;
        }
      } catch {
        lastError = "Gagal membuat pesanan. Coba lagi.";
        break;
      }
    }

    fetchUser();
    fetchHistory(1);
    setBulkOrdering(false);

    if (successCount < count && lastError) {
      setError(`${successCount}/${count} berhasil. ${lastError}`);
    }
  };

  const userFavorites = (user?.favorites || "").split(",").filter(Boolean);

  const toggleFavorite = async (code: string) => {
    const current = (user?.favorites || "").split(",").filter(Boolean);
    const updated = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    const newFavorites = updated.join(",");
    try {
      await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: newFavorites }),
      });
      fetchUser();
    } catch { /* silent */ }
  };

  const filteredServices = serviceList
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aFav = userFavorites.includes(a.code) ? -1 : 0;
      const bFav = userFavorites.includes(b.code) ? -1 : 0;
      return aFav - bFav;
    });

  const capitalizeFirst = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          {t("buy.title")}
        </h1>
        <p className="text-sm text-muted">
          {t("buy.desc")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Kiri: Beli Nomor */}
        <div className="w-full lg:w-96 shrink-0 space-y-4">
          {/* Server Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="w-4 h-4 text-primary" />
                {t("buy.selectServer")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => setSelectedServer(server)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
                      selectedServer.id === server.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/50 hover:border-primary/30"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${server.color} flex items-center justify-center text-lg`}
                    >
                      {server.icon}
                    </div>
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {server.name}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            server.status === "online"
                              ? "bg-success"
                              : "bg-warning"
                          }`}
                        />
                      </div>
                      <span className="text-xs text-muted">
                        {server.description}
                      </span>
                    </div>
                    {selectedServer.id === server.id && (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>

            </CardContent>
          </Card>

          {/* Country Selector */}
          <Card className="relative z-20" style={{ overflow: "visible" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                {t("buy.selectCountry")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingNegara ? (
                <div className="flex items-center justify-center py-6 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">{t("buy.loadingCountries")}</span>
                </div>
              ) : (
                <>
                  <div className="relative mb-3" ref={countryDropdownRef}>
                    <button
                      onClick={() => {
                        setShowCountryDropdown(!showCountryDropdown);
                        setCountrySearch("");
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border border-border text-sm hover:border-primary/50 transition-colors"
                    >
                      <span>
                        {selectedNegara
                          ? capitalizeFirst(selectedNegara.nama_negara)
                          : t("buy.selectCountry")}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted" />
                    </button>

                    {showCountryDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-72 overflow-hidden">
                        <div className="sticky top-0 p-2 bg-surface border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                            <input
                              type="text"
                              placeholder={t("buy.searchCountry")}
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {negaraList
                            .filter((n) =>
                              n.nama_negara
                                .toLowerCase()
                                .includes(countrySearch.toLowerCase())
                            )
                            .map((negara) => (
                              <button
                                key={negara.id_negara}
                                onClick={() => {
                                  setSelectedNegara(negara);
                                  setShowCountryDropdown(false);
                                  setCountrySearch("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${
                                  selectedNegara?.id_negara ===
                                  negara.id_negara
                                    ? "bg-primary/10 text-primary"
                                    : ""
                                }`}
                              >
                                {capitalizeFirst(negara.nama_negara)}
                              </button>
                            ))}
                          {negaraList.filter((n) =>
                            n.nama_negara
                              .toLowerCase()
                              .includes(countrySearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-4 text-sm text-muted text-center">
                              {t("buy.countryNotFound")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </>
              )}
            </CardContent>
          </Card>

          {/* Provider Dropdown - hidden for api2/Jupiter */}
          {selectedServer.id === "api1" && (
          <Card className="relative z-15" style={{ overflow: "visible" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" />
                {t("buy.provider")}
              </CardTitle>
            </CardHeader>
            <CardContent style={{ overflow: "visible" }}>
              {loadingOperator ? (
                <div className="flex items-center justify-center py-4 text-muted">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">{t("buy.loadingProviders")}</span>
                </div>
              ) : operatorList.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted">
                  {t("buy.selectCountryFirst")}
                </div>
              ) : (
                <div className="relative" ref={operatorDropdownRef}>
                  <button
                    onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border border-border text-sm hover:border-primary/50 transition-colors"
                  >
                    <span>{selectedOperator === "any" ? t("buy.allProviders") : capitalizeFirst(selectedOperator)}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>
                  {showOperatorDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
                      {operatorList.map((op) => (
                        <button
                          key={op}
                          onClick={() => { setSelectedOperator(op); setShowOperatorDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors ${selectedOperator === op ? "bg-primary/10 text-primary" : ""}`}
                        >
                          {op === "any" ? t("buy.allProviders") : capitalizeFirst(op)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Layanan Dropdown */}
          <Card className="relative z-10" style={{ overflow: "visible" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="w-4 h-4 text-primary" />
                {t("buy.selectService")}
              </CardTitle>
            </CardHeader>
            <CardContent style={{ overflow: "visible" }}>
              {loadingLayanan ? (
                <div className="flex items-center justify-center py-4 text-muted">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">{t("buy.loadingServices")}</span>
                </div>
              ) : serviceList.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted">
                  {t("buy.selectCountryFirst")}
                </div>
              ) : (
                <div className="relative" ref={serviceDropdownRef}>
                  <button
                    onClick={() => { setShowServiceDropdown(!showServiceDropdown); setSearchQuery(""); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-background border border-border text-sm hover:border-primary/50 transition-colors"
                  >
                    <span>{selectedService ? capitalizeFirst(selectedService.name) : t("buy.selectService")}</span>
                    <ChevronDown className="w-4 h-4 text-muted" />
                  </button>
                  {showServiceDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-72 overflow-hidden">
                      <div className="sticky top-0 p-2 bg-surface border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                          <input
                            type="text"
                            placeholder={t("buy.searchService")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredServices.map((service) => (
                          <button
                            key={service.code}
                            onClick={() => {
                              setSelectedService(service);
                              setShowServiceDropdown(false);
                              setSearchQuery("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-hover transition-colors flex items-center justify-between ${
                              selectedService?.code === service.code ? "bg-primary/10 text-primary" : ""
                            } ${service.stock === 0 ? "opacity-40" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(service.code); }}
                                className="shrink-0"
                              >
                                <Star className={`w-3 h-3 ${userFavorites.includes(service.code) ? "text-accent fill-accent" : "text-muted"}`} />
                              </button>
                              <div className={`w-1.5 h-1.5 rounded-full ${service.stock > 100 ? "bg-success" : service.stock > 20 ? "bg-accent" : "bg-error"}`} />
                              <span>{capitalizeFirst(service.name)}</span>
                              <span className="text-[10px] text-muted font-[family-name:var(--font-jetbrains-mono)] uppercase">{service.code}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted">{service.stock}</span>
                              <span className="text-xs font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">{formatRupiah(service.price)}</span>
                            </div>
                          </button>
                        ))}
                        {filteredServices.length === 0 && (
                          <div className="px-3 py-4 text-sm text-muted text-center">{t("buy.serviceNotFound")}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selected service info + Buy button */}
                  {selectedService && (
                    <div className="mt-3 p-3 rounded-xl bg-background/50 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">{t("buy.service")}</span>
                        <span className="font-medium">{capitalizeFirst(selectedService.name)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">{t("buy.price")}</span>
                        <span className="font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">{formatRupiah(selectedService.price)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">{t("buy.stock")}</span>
                        <span className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${selectedService.stock > 100 ? "bg-success" : selectedService.stock > 20 ? "bg-accent" : "bg-error"}`} />
                          {selectedService.stock} tersedia
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1 text-xs sm:text-sm"
                          onClick={() => handleBuy(selectedService)}
                          disabled={ordering !== null || bulkOrdering || selectedService.stock === 0}
                        >
                          {ordering ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t("common.processing")}</>
                          ) : (
                            <><ShoppingCart className="w-4 h-4" /> {t("buy.buyButton")} — {formatRupiah(selectedService.price)}</>
                          )}
                        </Button>
                        <Button
                          className="flex-1 text-xs sm:text-sm"
                          onClick={() => handleBulkBuy(selectedService, 5)}
                          disabled={ordering !== null || bulkOrdering || selectedService.stock < 5}
                        >
                          {bulkOrdering ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t("common.processing")}</>
                          ) : (
                            <><ShoppingCart className="w-4 h-4" /> 5x — {formatRupiah(selectedService.price * 5)}</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kanan: Riwayat Order */}
        <div className="flex-1 min-w-0">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-primary" />
              {t("buy.orderHistory")}
              {historyTotal > 0 && (
                <span className="text-muted font-normal text-sm">({historyTotal})</span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => window.open(`/api/orders/export${historyFilter !== "all" ? `?status=${historyFilter}` : ""}`, "_blank")}
            >
              <Download className="w-3.5 h-3.5" />
              {t("common.exportCsv")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="Cari nomor..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(1); }}
                className="pl-9"
              />
            </div>
            <Button size="sm" onClick={() => fetchHistory(1)}>
              <Search className="w-4 h-4" />
              {t("common.search")}
            </Button>
            {historySearch && (
              <Button variant="ghost" size="sm" onClick={() => { setHistorySearch(""); }}>
                {t("common.reset")}
              </Button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[
                { label: t("common.all"), value: "all" },
                { label: t("status.order.success"), value: "success" },
                { label: t("status.order.waiting"), value: "waiting" },
                { label: t("status.order.cancelled"), value: "cancelled" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setHistoryFilter(f.value)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    historyFilter === f.value
                      ? "bg-primary text-background"
                      : "bg-surface-hover text-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Tampilkan</span>
              <select
                value={historyLimit}
                onChange={(e) => { setHistoryLimit(Number(e.target.value)); setHistoryPage(1); }}
                className="bg-background border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary/50 text-foreground"
              >
                {[5, 10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-xs text-muted">entri</span>
            </div>
          </div>

          {/* Table */}
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : historyOrders.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <ShoppingCart className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t("buy.noOrders")}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs sm:text-sm text-muted border-b border-border">
                      <th className="pb-3 font-medium hidden md:table-cell">Waktu</th>
                      <th className="pb-3 font-medium">{t("buy.service")}</th>
                      <th className="pb-3 font-medium hidden sm:table-cell">{t("buy.price")}</th>
                      <th className="pb-3 font-medium">{t("buy.number")}</th>
                      <th className="pb-3 font-medium hidden lg:table-cell">{t("buy.selectCountry")}</th>
                      <th className="pb-3 font-medium">OTP</th>
                      <th className="pb-3 font-medium">{t("buy.status")}</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="text-xs sm:text-sm">
                    {historyOrders.map((o) => (
                      <tr key={o.id} className="border-b border-border/50 hover:bg-surface/30">
                        <td className="py-2 sm:py-3 text-muted whitespace-nowrap hidden md:table-cell">
                          {new Date(o.date).toLocaleString("id-ID", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 sm:py-3 font-medium">{o.service}</td>
                        <td className="py-2 sm:py-3 font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold whitespace-nowrap hidden sm:table-cell">
                          {formatRupiah(o.price)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-[family-name:var(--font-jetbrains-mono)]">
                              {o.number}
                            </span>
                            <button
                              onClick={() => handleCopyText(o.number, `num-${o.id}`)}
                              className="text-muted hover:text-primary transition-colors"
                              title="Salin nomor"
                            >
                              {copiedId === `num-${o.id}` ? (
                                <CheckCircle className="w-3.5 h-3.5 text-success" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 text-muted capitalize hidden lg:table-cell">{o.country}</td>
                        <td className="py-2 sm:py-3">
                          {o.code ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold tracking-wider">
                                {o.code}
                              </span>
                              <button
                                onClick={() => handleCopyText(o.code!, `otp-${o.id}`)}
                                className="text-muted hover:text-primary transition-colors"
                                title="Salin kode OTP"
                              >
                                {copiedId === `otp-${o.id}` ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={o.status === "success" ? "success" : o.status === "waiting" ? "warning" : "error"}
                          >
                            {o.status === "success" ? t("status.order.success") : o.status === "waiting" ? t("status.order.waiting") : t("status.order.cancelled")}
                          </Badge>
                        </td>
                        <td className="py-3">
                          {o.status === "waiting" && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancelOrder(o)}
                              disabled={cancellingId === o.id}
                            >
                              {cancellingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                              {t("status.order.cancelled")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted">
                  Halaman {historyPage} dari {historyTotalPages}
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs"
                    disabled={historyPage <= 1}
                    onClick={() => fetchHistory(historyPage - 1)}
                  >
                    {t("common.prev")}
                  </Button>
                  {Array.from({ length: Math.min(5, historyTotalPages) }, (_, i) => {
                    let page: number;
                    if (historyTotalPages <= 5) {
                      page = i + 1;
                    } else if (historyPage <= 3) {
                      page = i + 1;
                    } else if (historyPage >= historyTotalPages - 2) {
                      page = historyTotalPages - 4 + i;
                    } else {
                      page = historyPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => fetchHistory(page)}
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                          historyPage === page
                            ? "bg-primary text-background"
                            : "text-muted hover:text-foreground hover:bg-surface-hover"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => fetchHistory(historyPage + 1)}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
