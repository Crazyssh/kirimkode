"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  Info,
} from "lucide-react";

const ALL_SERVERS = [
  { id: "unified", name: "Bimasakti", icon: "⚡", description: "Server utama (gabungan api1+api2+api3+api5+api8)" },
  { id: "api1", name: "Mars", icon: "🔴", description: "JasaOTP V1 (cadangan)" },
  { id: "api4", name: "Neptune", icon: "🔵", description: "HeroSMS V2 (manual stock)" },
  { id: "api5", name: "Earth (Beta)", icon: "🌍", description: "Clowatch API v1 (BETA)" },
  { id: "api6", name: "Venus (Beta)", icon: "🪐", description: "5sim.net global (BETA)" },
  { id: "api7", name: "Mars V2", icon: "🔴", description: "Happy Pixel API (Mars terbaru)" },
  { id: "api8", name: "Mercury", icon: "☿️", description: "Clowatch API v2 (markup +Rp 115 dari Earth)" },
];

const ALL_UNIFIED_PROVIDERS = [
  { id: "api1", name: "Mars (api1)", description: "JasaOTP V1" },
  { id: "api2", name: "Jupiter (api2)", description: "JasaOTP V2" },
  { id: "api3", name: "Saturn (api3)", description: "HeroSMS V1" },
  { id: "api5", name: "Earth (api5)", description: "Clowatch API v1" },
  { id: "api8", name: "Mercury (api8)", description: "Clowatch API v2 (markup +Rp 115)" },
];

export default function ServerVisibilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [visibleServers, setVisibleServers] = useState<string[]>([]);
  const [unifiedProviders, setUnifiedProviders] = useState<string[]>([]);

  // Auto-clear feedback
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
    return () => clearTimeout(t);
  }, [error, success]);

  // Fetch settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/server-visibility");
        const data = await res.json();
        if (data?.data) {
          setVisibleServers(data.data.visibleServers || []);
          setUnifiedProviders(data.data.unifiedProviders || []);
        }
      } catch {
        setError("Gagal memuat setting");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleServer(id: string) {
    setVisibleServers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleUnifiedProvider(id: string) {
    setUnifiedProviders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/server-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleServers, unifiedProviders }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal menyimpan");
        return;
      }
      setSuccess("Setting berhasil disimpan. Buka /buy untuk verify.");
    } catch {
      setError("Gagal menyimpan setting");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="w-6 h-6 text-primary" />
          Server Visibility
        </h1>
        <p className="text-sm text-muted mt-1">
          Atur server mana yang muncul di halaman /buy dan provider mana yang ikut Bimasakti.
        </p>
      </div>

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
        {/* Server visibility di /buy page */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-primary" />
              Tampilkan di Halaman /buy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted mb-3">
              Centang server yang mau ditampilkan ke user di halaman beli OTP.
              User cuma bisa pilih server yang aktif.
            </p>
            {ALL_SERVERS.map((s) => {
              const checked = visibleServers.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleServer(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/50 hover:border-primary/30 opacity-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-lg">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-muted truncate">{s.description}</div>
                  </div>
                  {checked ? (
                    <Eye className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted shrink-0" />
                  )}
                </button>
              );
            })}

            {visibleServers.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Semua server di-hide. User gak bisa beli sama sekali. Pastikan minimal 1 server aktif.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unified providers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-accent" />
              Provider di Bimasakti (unified)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted mb-3">
              Centang provider yang ikut digabung di server <strong>Bimasakti</strong>.
              Provider yang di-uncheck tetep ada di DB tapi gak akan muncul saat user pilih Bimasakti.
            </p>
            {ALL_UNIFIED_PROVIDERS.map((p) => {
              const checked = unifiedProviders.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleUnifiedProvider(p.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
                    checked
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background/50 hover:border-accent/30 opacity-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted truncate">{p.description}</div>
                  </div>
                  {checked ? (
                    <Eye className="w-4 h-4 text-accent shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted shrink-0" />
                  )}
                </button>
              );
            })}

            {unifiedProviders.length === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Semua provider Bimasakti di-uncheck. Bimasakti akan kosong (gak ada negara/layanan).
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Catatan */}
      <Card>
        <CardContent className="flex items-start gap-2 text-xs text-muted">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <div className="space-y-1">
            <p>
              <strong>Cara kerja:</strong> Setting ini di-cache 30 detik di server. Perubahan akan terlihat di /buy dalam max ~30 detik (refresh halaman buat liat instan).
            </p>
            <p>
              <strong>Catatan Neptune:</strong> Stock & negara/layanan Neptune diatur di menu <a href="/admin/api4-stock" className="text-primary underline">Neptune Stock</a>. Halaman ini cuma toggle visibility tampilan.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Simpan Perubahan</>
          )}
        </Button>
      </div>
    </div>
  );
}
