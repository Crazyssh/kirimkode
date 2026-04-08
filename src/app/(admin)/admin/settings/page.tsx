"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";

export default function AdminSettingsPage() {
  const [waNumber, setWaNumber] = useState("");
  const [savedWa, setSavedWa] = useState<string | null>(null);
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
    </div>
  );
}
