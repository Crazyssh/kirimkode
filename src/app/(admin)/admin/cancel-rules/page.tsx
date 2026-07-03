"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Timer, Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface Rule {
  code: string;
  minutes: number;
}

export default function CancelRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cancel-rules");
      if (res.ok) {
        const json = await res.json();
        const arr: Rule[] = Object.entries(json.rules || {}).map(([code, minutes]) => ({
          code,
          minutes: Number(minutes),
        }));
        setRules(arr);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const addRule = () => setRules((r) => [...r, { code: "", minutes: 3 }]);
  const removeRule = (i: number) => setRules((r) => r.filter((_, idx) => idx !== i));
  const updateRule = (i: number, patch: Partial<Rule>) =>
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));

  const save = async () => {
    // Bangun map, buang code kosong
    const map: Record<string, number> = {};
    for (const r of rules) {
      const code = r.code.trim().toLowerCase();
      if (!code) continue;
      if (!Number.isFinite(r.minutes) || r.minutes < 0 || r.minutes > 15) {
        toast.error(`Menit untuk "${code || "?"}" harus 0-15`);
        return;
      }
      map[code] = r.minutes;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cancel-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: map }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Aturan cancel disimpan");
        fetchRules();
      } else {
        toast.error(json.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Gagal menyimpan aturan");
    }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Waktu Cancel per Layanan
        </h1>
        <p className="text-sm text-muted">
          Atur berapa menit user harus menunggu sebelum bisa membatalkan order, per kode layanan.
          Layanan yang tidak diatur di sini mengikuti aturan default per-server.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="w-4 h-4 text-primary" />
              Aturan Cancel
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={addRule}>
              <Plus className="w-4 h-4" /> Tambah
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {rules.length === 0 && (
                <p className="text-sm text-muted text-center py-4">
                  Belum ada aturan. Klik &quot;Tambah&quot; untuk membuat.
                </p>
              )}
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Kode layanan (mis. wa, tg, go)"
                      value={rule.code}
                      onChange={(e) => updateRule(i, { code: e.target.value })}
                    />
                  </div>
                  <div className="w-32 flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="15"
                      value={rule.minutes}
                      onChange={(e) => updateRule(i, { minutes: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted whitespace-nowrap">menit</span>
                  </div>
                  <button
                    onClick={() => removeRule(i)}
                    className="p-2 text-muted hover:text-error transition-colors"
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="pt-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </Button>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-surface/50 border border-border text-xs text-muted space-y-1">
                <p>• Kode layanan contoh: <span className="font-mono">wa</span> (WhatsApp), <span className="font-mono">tg</span> (Telegram), <span className="font-mono">go</span> (Google).</p>
                <p>• Maksimal 15 menit (harus di bawah timeout auto-refund 20 menit).</p>
                <p>• Berlaku untuk semua server. Layanan tanpa aturan pakai default per-server.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
