"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
import {
  Wallet,
  QrCode,
  Smartphone,
  Building2,
  CheckCircle,
  Clock,
  ArrowRight,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Ticket,
  Send,
  XCircle,
} from "lucide-react";

interface PaymentChannel {
  code: string;
  name: string;
  type: string;
  type_label: string;
  icon: string | null;
  fee: { flat: number; percent: number; display: string };
}

interface DepositResult {
  trx_id: string;
  reference_id: string;
  amount: string;
  final_amount?: string;
  unique_code?: string;
  fee?: string;
  status: string;
  pay_url: string;
  gateway?: string;
  admin_telegram?: string;
  payment_info: {
    transaction_id?: string;
    transaction_status?: string;
    bank?: string;
    va_number?: string;
    checkout_url?: string;
    qr_url?: string;
    payment_page?: string;
    expiration_date?: string;
  };
}

interface DepositHistoryItem {
  id: string;
  trxId: string;
  amount: number;
  method: string;
  status: string;
  time: string;
  payUrl: string | null;
  gateway: string;
}

const presetAmounts = [10000, 25000, 50000, 100000, 250000, 500000];

export default function DepositPage() {
  const { user, fetchUser } = useUserStore();
  const { t } = useLanguageStore();
  const [amount, setAmount] = useState<number>(50000);
  const [channels, setChannels] = useState<{ va: PaymentChannel[]; ewallet: PaymentChannel[]; qris: PaymentChannel[] } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>("qris");
  const [depositHistory, setDepositHistory] = useState<DepositHistoryItem[]>([]);
  const [step, setStep] = useState<"amount" | "payment" | "done">("amount");
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [depositResult, setDepositResult] = useState<DepositResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [error, setError] = useState<string>("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancellingTrxId, setCancellingTrxId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherApplied, setVoucherApplied] = useState<{ code: string; bonus: number; description: string } | null>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [depositDisabled, setDepositDisabled] = useState(false);

  // Cek apakah deposit aktif
  useEffect(() => {
    async function checkDepositStatus() {
      try {
        const res = await fetch("/api/settings?key=deposit_enabled");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.value === "false") {
            setDepositDisabled(true);
          }
        }
      } catch {
        // silent
      }
    }
    checkDepositStatus();
  }, []);

  // Detect ?status=success — user balik dari Paymenku setelah bayar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      setStep("done");
      setPaymentStatus("paid");
      fetchUser(); // refresh saldo
      // Bersihin query string biar gak nge-trigger ulang kalau user navigate
      window.history.replaceState({}, "", "/deposit");
    }
  }, [fetchUser]);

  // Fetch deposit history (extracted supaya bisa dipanggil ulang setelah cancel)
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setDepositHistory(
          (json.data.recentDeposits || []).map(
            (d: {
              id: string;
              trxId: string;
              amount: number;
              method: string;
              status: string;
              time: string;
              payUrl: string | null;
              gateway: string;
            }) => ({
              id: d.id,
              trxId: d.trxId,
              amount: d.amount,
              method: d.method,
              status: d.status,
              time: new Date(d.time).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
              payUrl: d.payUrl,
              gateway: d.gateway,
            })
          )
        );
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch payment channels & deposit history
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch("/api/deposit/channels");
        const data = await res.json();
        if (data.status === "success") {
          setChannels(data.data);
          // Auto-select channel pertama
          const allCh = [...(data.data.qris || []), ...(data.data.ewallet || []), ...(data.data.va || [])];
          if (allCh.length > 0) {
            setSelectedChannel(allCh[0].code);
          }
        }
      } catch {
        console.error("Gagal fetch channels");
      } finally {
        setLoadingChannels(false);
      }
    }
    fetchChannels();
    fetchHistory();
  }, [fetchHistory]);

  // Polling status pembayaran setiap 5 detik
  const checkStatus = useCallback(async () => {
    if (!depositResult) return;
    try {
      const res = await fetch(`/api/deposit/status?order_id=${depositResult.trx_id}`);
      const data = await res.json();
      if (data.status === "success") {
        setPaymentStatus(data.data.status);
        if (data.data.status === "paid") {
          setStep("done");
          fetchUser(); // Refresh balance
          if (typeof window !== "undefined" && window.gtag) {
            window.gtag("event", "purchase", {
              transaction_id: depositResult?.trx_id,
              currency: "IDR",
              value: depositResult ? parseFloat(String(depositResult.amount)) : 0,
            });
          }
        }
      }
    } catch {
      // silent fail
    }
  }, [depositResult, fetchUser]);

  // Stop polling untuk semua terminal status (paid/cancelled/expired/failed/refunded)
  const isTerminalStatus = (s: string) =>
    s === "paid" ||
    s === "cancelled" ||
    s === "expired" ||
    s === "failed" ||
    s === "refunded";

  useEffect(() => {
    if (step !== "payment" || !depositResult) return;
    if (isTerminalStatus(paymentStatus)) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [step, depositResult, paymentStatus, checkStatus]);

  // Cancel deposit aktif (di step "payment")
  async function handleCancelDeposit() {
    if (!depositResult || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trx_id: depositResult.trx_id }),
      });
      const data = await res.json();

      // Sukses cancel atau gateway return terminal status
      if (res.ok || res.status === 409) {
        const newStatus = data?.data?.status || data?.status || "cancelled";
        setPaymentStatus(newStatus);
        setCancelConfirm(false);

        if (newStatus === "paid") {
          // Race: sudah dibayar — credit balance, lanjut ke done
          setStep("done");
          fetchUser();
        } else if (data?.message) {
          // Informational, tidak fatal
          setError(data.message);
        }
        fetchHistory(); // refresh sidebar
      } else {
        setError(data?.error || "Gagal membatalkan deposit");
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat membatalkan");
    } finally {
      setCancelling(false);
    }
  }

  // Cancel deposit dari riwayat (item history)
  async function handleCancelFromHistory(trxId: string) {
    if (cancellingTrxId) return;
    const confirmed = window.confirm(
      "Yakin batalkan deposit ini?\n\nJika kamu sudah transfer, JANGAN klik OK — tunggu konfirmasi otomatis."
    );
    if (!confirmed) return;

    setCancellingTrxId(trxId);
    try {
      const res = await fetch("/api/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trx_id: trxId }),
      });
      const data = await res.json();

      if (res.ok || res.status === 409) {
        const newStatus = data?.data?.status || data?.status || "cancelled";

        if (newStatus === "paid") {
          // Race: ternyata sudah dibayar — saldo sudah di-credit di backend
          alert(
            "Pembayaran sudah terdeteksi! Saldo sudah ditambahkan ke akun kamu."
          );
          fetchUser();
        }
        fetchHistory();
      } else {
        alert(data?.error || "Gagal membatalkan deposit");
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat membatalkan");
    } finally {
      setCancellingTrxId(null);
    }
  }

  // Buat deposit
  async function handleCreateDeposit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          channel_code: selectedChannel,
        }),
      });

      // Defensive parse — kalau Paymenku/server bermasalah, response bisa
      // berupa HTML (500 page). Treat parsing gagal sebagai error gateway.
      const rawText = await res.text();
      // Use loose typing — beberapa field optional saat error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        setError(
          "Layanan pembayaran sedang bermasalah. Silakan coba lagi atau pilih metode pembayaran lain."
        );
        return;
      }

      if (!res.ok) {
        setError(data?.error || `Gagal membuat deposit (HTTP ${res.status}).`);
        return;
      }

      if (data.status === "success") {
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "begin_checkout", {
            currency: "IDR",
            value: amount,
            payment_method: selectedChannel,
          });
        }

        // Paymenku QRIS → redirect langsung ke pay_url Paymenku
        // QR tidak ditampilkan di web kita.
        if (selectedChannel === "QRIS") {
          const payUrl = data.data.pay_url;
          if (payUrl) {
            window.location.href = payUrl;
            return;
          }
          // Fallback kalau pay_url kosong (seharusnya gak terjadi)
          setError("Gagal membuka halaman pembayaran Paymenku");
          return;
        }

        // BAYAR.GG / Manual QRIS → tampil QR inline di web
        setDepositResult(data.data);
        setPaymentStatus("pending");
        setStep("payment");

        // Auto buka tab baru kalau QR gak tersedia (fallback bayargg)
        const qrUrl = data.data.payment_info?.qr_url;
        if (!qrUrl) {
          const payUrl = data.data.payment_info?.checkout_url || data.data.pay_url;
          if (payUrl) {
            window.open(payUrl, "_blank");
          }
        }
      } else {
        setError(data.error || "Gagal membuat deposit");
      }
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  // Ambil semua channels dalam satu flat list untuk ditampilkan
  const allChannels: (PaymentChannel & { group: string })[] = channels
    ? [
      ...(channels.qris || []).map((c) => ({ ...c, group: "QRIS" })),
      ...(channels.ewallet || []).map((c) => ({ ...c, group: "E-Wallet" })),
      ...(channels.va || []).map((c) => ({ ...c, group: "Virtual Account" })),
    ]
    : [];

  const selectedChannelObj = allChannels.find((c) => c.code === selectedChannel);

  function getChannelIcon(type: string) {
    switch (type) {
      case "qris": return QrCode;
      case "ewallet": return Smartphone;
      case "va": return Building2;
      default: return Wallet;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          {t("deposit.title")}
        </h1>
        <p className="text-sm text-muted">{t("deposit.desc")}</p>
      </div>

      {/* Deposit Disabled Banner */}
      {depositDisabled && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive">Deposit Sedang Dinonaktifkan</p>
              <p className="text-sm text-muted-foreground">
                Fitur deposit sedang ditutup sementara oleh admin. Silakan coba lagi nanti atau hubungi admin untuk informasi lebih lanjut.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Card */}
      <Card className="border-primary/30">
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted">{t("deposit.currentBalance")}</div>
              <div className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                {formatRupiah(user?.balance ?? 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Step 1: Pilih Nominal & Channel */}
          {step === "amount" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("deposit.amount")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2 text-sm text-error">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {presetAmounts.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(preset)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium font-[family-name:var(--font-jetbrains-mono)] transition-all ${amount === preset
                          ? "bg-primary text-background shadow-[0_0_15px_var(--shadow-primary)]"
                          : "bg-background border border-border hover:border-primary/50"
                        }`}
                    >
                      {formatRupiah(preset)}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-sm text-muted mb-1.5 block">
                    {t("deposit.customAmount")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                    <Input
                      type="number"
                      placeholder="0"
                      className="pl-10 font-[family-name:var(--font-jetbrains-mono)]"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      min={1000}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">{t("deposit.minDeposit")}</p>
                </div>

                {/* Payment Channels */}
                <div className="space-y-3">
                  <label className="text-sm text-muted block">{t("deposit.paymentMethod")}</label>

                  {loadingChannels ? (
                    <div className="flex items-center justify-center py-8 text-muted">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      {t("deposit.loadingMethods")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allChannels.map((channel) => {
                        const Icon = getChannelIcon(channel.type);
                        return (
                          <button
                            key={channel.code}
                            onClick={() => setSelectedChannel(channel.code)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${selectedChannel === channel.code
                                ? "border-primary/50 bg-primary/5"
                                : "border-border hover:border-primary/30"
                              }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
                              {channel.icon ? (
                                <img src={channel.icon} alt={channel.name} className="w-6 h-6 rounded" width={24} height={24} loading="lazy" />
                              ) : (
                                <Icon className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{channel.name}</span>
                                <Badge variant="default">{channel.type_label}</Badge>
                              </div>
                              <div className="text-xs text-muted">
                                {t("deposit.fee")}: {channel.fee.display}
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedChannel === channel.code ? "border-primary" : "border-border"
                              }`}>
                              {selectedChannel === channel.code && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Summary */}
                {selectedChannelObj && (
                  <div className="p-4 rounded-xl bg-background/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">{t("deposit.nominal")}</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)]">{formatRupiah(amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">{t("deposit.fee")} ({selectedChannelObj.name})</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-muted">
                        {selectedChannelObj.fee.display}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                      <span>{t("deposit.totalPay")}</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary">
                        ~{formatRupiah(
                          amount +
                          selectedChannelObj.fee.flat +
                          Math.ceil((amount * selectedChannelObj.fee.percent) / 100)
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Voucher */}
                <div className="p-3 rounded-xl bg-background/50 border border-border space-y-2">
                  <label className="text-xs text-muted flex items-center gap-1">
                    <Ticket className="w-3 h-3" /> {t("deposit.voucherCode")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={voucherCode}
                      onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); setVoucherApplied(null); }}
                      placeholder={t("deposit.enterVoucher")}
                      className="flex-1"
                      disabled={!!voucherApplied}
                    />
                    {voucherApplied ? (
                      <Button variant="ghost" size="sm" onClick={() => { setVoucherApplied(null); setVoucherCode(""); }}>
                        {t("deposit.removeVoucher")}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!voucherCode || applyingVoucher}
                        onClick={async () => {
                          setApplyingVoucher(true); setVoucherError("");
                          try {
                            const res = await fetch("/api/voucher/apply", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ code: voucherCode, depositAmount: amount }),
                            });
                            const data = await res.json();
                            if (res.ok && data.success) {
                              setVoucherApplied(data.data);
                              fetchUser();
                            } else {
                              setVoucherError(data.error || "Voucher tidak valid");
                            }
                          } catch { setVoucherError("Gagal menggunakan voucher"); }
                          finally { setApplyingVoucher(false); }
                        }}
                      >
                        {applyingVoucher ? <Loader2 className="w-3 h-3 animate-spin" /> : t("deposit.useVoucher")}
                      </Button>
                    )}
                  </div>
                  {voucherError && <p className="text-[10px] text-error">{voucherError}</p>}
                  {voucherApplied && (
                    <p className="text-[10px] text-success">
                      Voucher {voucherApplied.code} diterapkan! Bonus Rp {voucherApplied.bonus.toLocaleString("id-ID")} sudah ditambahkan ke saldo.
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateDeposit}
                  disabled={amount < 1000 || loading || loadingChannels || depositDisabled}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("common.processing")}
                    </>
                  ) : (
                    <>
                      {t("deposit.payNow")} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Pembayaran */}
          {step === "payment" && depositResult && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className={`w-2 h-2 rounded-full ${paymentStatus === "pending" ? "bg-accent animate-pulse" : "bg-success"}`} />
                  {paymentStatus === "pending" ? t("deposit.waitingPayment") : t("deposit.paymentSuccess")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info Transaksi */}
                <div className="p-4 rounded-xl bg-background/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">{t("deposit.transactionId")}</span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">{depositResult.trx_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">{t("deposit.totalPay")}</span>
                    <span className="font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                      Rp {parseFloat(depositResult.final_amount || depositResult.amount).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {depositResult.unique_code && depositResult.unique_code !== "0" && (
                    <div className="flex justify-between">
                      <span className="text-muted">Kode Unik</span>
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-accent font-bold">+{parseInt(depositResult.unique_code).toLocaleString("id-ID")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">{t("deposit.status")}</span>
                    <Badge
                      variant={
                        paymentStatus === "paid"
                          ? "success"
                          : paymentStatus === "cancelled" ||
                            paymentStatus === "expired" ||
                            paymentStatus === "failed" ||
                            paymentStatus === "refunded"
                          ? "error"
                          : "warning"
                      }
                    >
                      {paymentStatus === "paid"
                        ? t("status.deposit.paid")
                        : paymentStatus === "cancelled"
                        ? "Dibatalkan"
                        : paymentStatus === "expired"
                        ? "Kedaluwarsa"
                        : paymentStatus === "failed"
                        ? "Gagal"
                        : paymentStatus === "refunded"
                        ? "Direfund"
                        : t("status.deposit.pending")}
                    </Badge>
                  </div>
                  {depositResult.payment_info.expiration_date && (
                    <div className="flex justify-between">
                      <span className="text-muted">{t("deposit.deadline")}</span>
                      <span className="text-xs text-accent flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(depositResult.payment_info.expiration_date).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Virtual Account Number */}
                {depositResult.payment_info.va_number && (
                  <div className="text-center p-6 rounded-xl bg-surface border border-border">
                    <div className="text-xs text-muted mb-1">
                      Transfer ke {depositResult.payment_info.bank} Virtual Account
                    </div>
                    <div className="text-2xl font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary tracking-wider">
                      {depositResult.payment_info.va_number}
                    </div>
                  </div>
                )}

                {/* QRIS QR Code */}
                {depositResult.payment_info.qr_url ? (
                  <div className="text-center">
                    <div className="w-64 h-64 mx-auto bg-white rounded-2xl p-4 flex items-center justify-center">
                      <img
                        src={depositResult.payment_info.qr_url}
                        alt="QRIS QR Code"
                        className="w-full h-full object-contain"
                        width={224}
                        height={224}
                      />
                    </div>
                    <p className="text-xs text-muted mt-2">Scan QR dengan e-wallet atau mobile banking</p>
                  </div>
                ) : (depositResult.pay_url || depositResult.payment_info.checkout_url) ? (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted">Halaman pembayaran sudah terbuka di tab baru.</p>
                    <a
                      href={depositResult.payment_info.checkout_url || depositResult.pay_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="secondary" className="w-full">
                        <ExternalLink className="w-4 h-4" />
                        Buka Ulang Halaman Pembayaran
                      </Button>
                    </a>
                  </div>
                ) : null}

                {/* Manual QRIS: Tombol Sudah Bayar → Telegram */}
                {depositResult.gateway === "manual_qris" && depositResult.admin_telegram && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 text-center space-y-2">
                      <p className="text-sm font-medium text-orange-400">
                        ⚠️ Deposit ini dikonfirmasi manual oleh admin
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Setelah scan & bayar, klik tombol di bawah untuk konfirmasi ke admin via Telegram.
                      </p>
                    </div>
                    <a
                      href={`https://t.me/${depositResult.admin_telegram}?text=${encodeURIComponent(
                        `Halo admin, saya sudah bayar deposit QRIS Manual.\n\nTRX ID: ${depositResult.trx_id}\nJumlah: Rp ${Number(depositResult.final_amount || depositResult.amount).toLocaleString("id-ID")}\n\nMohon dikonfirmasi. Terima kasih! 🙏`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                        <Send className="w-4 h-4 mr-2" />
                        Sudah Bayar — Konfirmasi via Telegram
                      </Button>
                    </a>
                  </div>
                )}

                {paymentStatus === "pending" && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {t("deposit.autoUpdateStatus")}
                  </div>
                )}

                {/* Banner buat status terminal non-paid */}
                {(paymentStatus === "cancelled" ||
                  paymentStatus === "expired" ||
                  paymentStatus === "failed" ||
                  paymentStatus === "refunded") && (
                  <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-2 text-sm text-error">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {paymentStatus === "cancelled" && (
                        <>Deposit ini sudah dibatalkan. Buat deposit baru untuk melanjutkan.</>
                      )}
                      {paymentStatus === "expired" && (
                        <>Deposit ini sudah kedaluwarsa. Silakan buat deposit baru.</>
                      )}
                      {paymentStatus === "failed" && (
                        <>Pembayaran gagal diproses oleh payment gateway.</>
                      )}
                      {paymentStatus === "refunded" && (
                        <>Deposit ini telah direfund.</>
                      )}
                    </div>
                  </div>
                )}

                {/* Cancel confirmation banner */}
                {cancelConfirm && paymentStatus === "pending" && (
                  <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 space-y-2">
                    <div className="flex items-start gap-2 text-sm text-foreground">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
                      <div>
                        Yakin batalkan deposit ini? Jika kamu sudah transfer, JANGAN klik batal —
                        tunggu konfirmasi otomatis.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => setCancelConfirm(false)}
                        disabled={cancelling}
                      >
                        Tidak, lanjut bayar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        onClick={handleCancelDeposit}
                        disabled={cancelling}
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Membatalkan...
                          </>
                        ) : (
                          <>Ya, batalkan</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tombol aksi utama */}
                {paymentStatus === "pending" ? (
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setCancelConfirm(true)}
                      disabled={cancelling || cancelConfirm}
                    >
                      <XCircle className="w-4 h-4" />
                      Batalkan
                    </Button>
                    <Button className="flex-1" onClick={checkStatus}>
                      <RefreshCw className="w-4 h-4" />
                      {t("deposit.checkStatus")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setStep("amount");
                      setDepositResult(null);
                      setPaymentStatus("pending");
                      setCancelConfirm(false);
                      setError("");
                    }}
                  >
                    {t("deposit.newDeposit")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Berhasil */}
          {step === "done" && (
            <Card className="animate-fade-in border-success/30">
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] mb-2">
                  {t("deposit.paymentSuccess")}!
                </h2>
                <p className="text-sm text-muted mb-2">
                  {t("deposit.balanceAdded")}
                </p>
                {depositResult && (
                  <p className="text-xs text-muted font-[family-name:var(--font-jetbrains-mono)] mb-6">
                    TRX: {depositResult.trx_id}
                  </p>
                )}
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStep("amount");
                      setDepositResult(null);
                    }}
                  >
                    {t("deposit.depositAgain")}
                  </Button>
                  <Button onClick={() => (window.location.href = "/buy")}>
                    {t("deposit.buyOtp")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Deposit History */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("deposit.depositHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {depositHistory.map((dep) => {
                  const isPending = dep.status === "pending";
                  const isTerminalFail =
                    dep.status === "cancelled" ||
                    dep.status === "expired" ||
                    dep.status === "failed" ||
                    dep.status === "refunded";
                  const cancellingThis = cancellingTrxId === dep.trxId;

                  return (
                    <div
                      key={dep.id}
                      className="p-3 rounded-xl bg-background/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium font-[family-name:var(--font-jetbrains-mono)]">
                            +{formatRupiah(dep.amount)}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {dep.trxId}
                          </div>
                          <div className="text-xs text-muted">
                            {dep.method} &middot; {dep.time}
                          </div>
                        </div>
                        <Badge
                          variant={
                            dep.status === "paid"
                              ? "success"
                              : isTerminalFail
                              ? "error"
                              : "warning"
                          }
                        >
                          {dep.status === "paid"
                            ? t("status.deposit.paid")
                            : dep.status === "cancelled"
                            ? "Batal"
                            : dep.status === "expired"
                            ? "Expired"
                            : dep.status === "failed"
                            ? "Gagal"
                            : dep.status === "refunded"
                            ? "Refund"
                            : t("status.deposit.pending")}
                        </Badge>
                      </div>

                      {/* Action buttons untuk deposit pending */}
                      {isPending && (
                        <div className="flex gap-2 pt-1">
                          {dep.payUrl && (
                            <a
                              href={dep.payUrl}
                              target={dep.gateway === "paymenku" ? "_self" : "_blank"}
                              rel="noopener noreferrer"
                              className="flex-1"
                            >
                              <Button
                                variant="secondary"
                                size="sm"
                                className="w-full"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {dep.gateway === "paymenku" ? "Bayar" : "Buka QRIS"}
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={dep.payUrl ? "flex-1" : "w-full"}
                            onClick={() => handleCancelFromHistory(dep.trxId)}
                            disabled={cancellingThis}
                          >
                            {cancellingThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Batal
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {depositHistory.length === 0 && (
                  <div className="text-xs text-muted text-center py-6">
                    Belum ada riwayat deposit.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
