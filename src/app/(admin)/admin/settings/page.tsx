"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, AlertCircle, MessageCircle, Wallet, QrCode, Send } from "lucide-react";

export default function AdminSettingsPage() {
  const [waNumber, setWaNumber] = useState("");
  const [savedWa, setSavedWa] = useState<string | null>(null);
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [togglingDeposit, setTogglingDeposit] = useState(false);
  const [manualQrisEnabled, setManualQrisEnabled] = useState(false);
  const [togglingManualQris, setTogglingManualQris] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState("");
  const [savedTelegram, setSavedTelegram] = useState<string | null>(null);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        const wa = json.data?.wa_number ?? "";
        setWaNumber(wa);
        setSavedWa(wa);
        setDepositEnabled(json.data?.deposit_enabled !== "false");
        setManualQrisEnabled(json.data?.manual_qris_enabled === "true");
        const tg = json.data?.admin_telegram_username ?? "";
        setTelegramUsername(tg);
        setSavedTelegram(tg);
      }
    } catch {
      setError("Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "wa_number", value: waNumber }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menyimpan");
      } else {
        setSavedWa(json.data.value);
        setWaNumber(json.data.value);
        setSuccess("Nomor WA berhasil disimpan!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan Situs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Konfigurasi umum untuk tampilan website.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-500" />
            Nomor WhatsApp Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Nomor WA (format internasional, tanpa + atau spasi)
                </label>
                <Input
                  placeholder="Contoh: 6283186072571"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Nomor diawali kode negara. Contoh: 0831... → <strong>62831...</strong>
                </p>
              </div>

              {savedWa && (
                <p className="text-xs text-muted-foreground">
                  Tersimpan saat ini:{" "}
                  <a
                    href={`https://wa.me/${savedWa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 underline"
                  >
                    +{savedWa}
                  </a>
                </p>
              )}

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  {success}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving || waNumber === savedWa}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Deposit On/Off Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-blue-500" />
            Fitur Deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Status Deposit</p>
                  <p className="text-xs text-muted-foreground">
                    {depositEnabled
                      ? "User dapat melakukan deposit saat ini."
                      : "Deposit dinonaktifkan. User tidak bisa melakukan deposit."}
                  </p>
                </div>
                <Button
                  variant={depositEnabled ? "primary" : "secondary"}
                  size="sm"
                  disabled={togglingDeposit}
                  onClick={async () => {
                    setTogglingDeposit(true);
                    try {
                      const newValue = !depositEnabled;
                      const res = await fetch("/api/admin/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          key: "deposit_enabled",
                          value: String(newValue),
                        }),
                      });
                      if (res.ok) {
                        setDepositEnabled(newValue);
                      }
                    } catch {
                      // silent
                    } finally {
                      setTogglingDeposit(false);
                    }
                  }}
                  className="min-w-[80px]"
                >
                  {togglingDeposit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : depositEnabled ? (
                    "ON"
                  ) : (
                    "OFF"
                  )}
                </Button>
              </div>

              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  depositEnabled
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                }`}
              >
                {depositEnabled ? "✅ Deposit AKTIF" : "⛔ Deposit NONAKTIF"}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual QRIS On/Off Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4 text-orange-500" />
            QRIS Manual (Konfirmasi Admin)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">QRIS Manual</p>
                  <p className="text-xs text-muted-foreground">
                    {manualQrisEnabled
                      ? "QRIS Manual aktif. User dapat deposit via QRIS manual (konfirmasi admin)."
                      : "QRIS Manual nonaktif. Channel ini tidak tampil di halaman deposit."}
                  </p>
                </div>
                <Button
                  variant={manualQrisEnabled ? "primary" : "secondary"}
                  size="sm"
                  disabled={togglingManualQris}
                  onClick={async () => {
                    setTogglingManualQris(true);
                    try {
                      const newValue = !manualQrisEnabled;
                      const res = await fetch("/api/admin/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          key: "manual_qris_enabled",
                          value: String(newValue),
                        }),
                      });
                      if (res.ok) {
                        setManualQrisEnabled(newValue);
                      }
                    } catch {
                      // silent
                    } finally {
                      setTogglingManualQris(false);
                    }
                  }}
                  className="min-w-[80px]"
                >
                  {togglingManualQris ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : manualQrisEnabled ? (
                    "ON"
                  ) : (
                    "OFF"
                  )}
                </Button>
              </div>
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  manualQrisEnabled
                    ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                    : "bg-muted/50 text-muted-foreground border border-border"
                }`}
              >
                {manualQrisEnabled ? "✅ QRIS Manual AKTIF — Fee Rp 100" : "⛔ QRIS Manual NONAKTIF"}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Telegram Username */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-blue-400" />
            Username Telegram Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Username Telegram (tanpa @)
                </label>
                <Input
                  placeholder="Contoh: admin_kirimkode"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ""))}
                  disabled={savingTelegram}
                />
                <p className="text-xs text-muted-foreground">
                  Digunakan untuk redirect user setelah bayar QRIS Manual.
                </p>
              </div>

              {savedTelegram && (
                <p className="text-xs text-muted-foreground">
                  Tersimpan:{" "}
                  <a
                    href={`https://t.me/${savedTelegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    @{savedTelegram}
                  </a>
                </p>
              )}

              <Button
                onClick={async () => {
                  setSavingTelegram(true);
                  setSuccess(""); setError("");
                  try {
                    const res = await fetch("/api/admin/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key: "admin_telegram_username", value: telegramUsername }),
                    });
                    const json = await res.json();
                    if (!res.ok) {
                      setError(json.error || "Gagal menyimpan");
                    } else {
                      setSavedTelegram(json.data.value);
                      setTelegramUsername(json.data.value);
                      setSuccess("Username Telegram berhasil disimpan!");
                      setTimeout(() => setSuccess(""), 3000);
                    }
                  } catch {
                    setError("Gagal menghubungi server");
                  } finally {
                    setSavingTelegram(false);
                  }
                }}
                disabled={savingTelegram || telegramUsername === savedTelegram}
              >
                {savingTelegram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
