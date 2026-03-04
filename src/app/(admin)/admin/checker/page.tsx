"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  MessageCircle,
  User,
  CheckCircle,
  Image,
  List,
} from "lucide-react";

interface WaResult {
  exists: boolean;
  profilePic?: string | null;
  jid?: string | null;
  number?: string;
  sessionUsed?: string;
}

interface BulkResultItem {
  number: string;
  data: WaResult | null;
}

export default function AdminCheckerPage() {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [waResult, setWaResult] = useState<WaResult | null>(null);
  const [error, setError] = useState("");

  // Bulk checker state
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResultItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ checked: 0, total: 0 });

  /** Auto-format nomor: tambah country code kalau belum ada */
  const formatNumber = (num: string): string => {
    const digits = num.replace(/[^0-9]/g, "");
    // Sudah punya country code (dimulai 1-9 dan panjang >= 10)
    if (digits.length >= 10) return digits;
    // Nomor lokal Indonesia (08xxx) → 628xxx
    if (digits.startsWith("08")) return "62" + digits.slice(1);
    if (digits.startsWith("8") && digits.length >= 9 && digits.length <= 12) return "62" + digits;
    return digits;
  };

  const handleCheck = async () => {
    if (!number.trim()) return;
    setLoading(true);
    setError("");
    setWaResult(null);

    try {
      const res = await fetch("/api/admin/checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: formatNumber(number.trim()) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal mengecek nomor");
        return;
      }
      setWaResult(json.data);
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCheck = async () => {
    const matches = bulkNumbers.match(/\+\d{10,15}/g);
    const numbers = matches
      ? [...new Set(matches.map((m) => m.replace(/^\+/, "")))]
      : bulkNumbers
        .split(/[\n,;]+/)
        .map((n) => formatNumber(n.trim()))
        .filter((n) => n.length >= 8);

    if (numbers.length === 0) return;

    setBulkLoading(true);
    setBulkResults([]);
    setBulkProgress({ checked: 0, total: numbers.length });

    const results: BulkResultItem[] = [];

    for (let i = 0; i < numbers.length; i++) {
      try {
        const res = await fetch("/api/admin/checker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: numbers[i] }),
        });
        const json = await res.json();
        results.push({
          number: numbers[i],
          data: res.ok ? json.data : null,
        });
      } catch {
        results.push({ number: numbers[i], data: null });
      }
      setBulkProgress({ checked: i + 1, total: numbers.length });
      setBulkResults([...results]);
    }

    setBulkLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          WhatsApp Checker
        </h1>
        <p className="text-sm text-muted">Cek status nomor di WhatsApp</p>
      </div>

      {/* Single Check */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">Cek Satu Nomor</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="Masukkan nomor (contoh: 6281234567890 atau 081234567890)"
                className="pl-9 font-[family-name:var(--font-jetbrains-mono)]"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onBlur={() => { if (number.trim()) setNumber(formatNumber(number.trim())); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
              />
            </div>
            <Button onClick={handleCheck} disabled={loading || !number.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Cek WA
            </Button>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Check Result */}
      {waResult && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-green-400" />
              <h3 className="font-bold">WhatsApp</h3>
              <Badge variant={waResult.exists ? "success" : "error"}>
                {waResult.exists ? "Terdaftar" : "Tidak Terdaftar"}
              </Badge>
            </div>
            <div className="space-y-3 text-sm">
              <InfoRow icon={<CheckCircle className="w-4 h-4" />} label="Status" value={waResult.exists ? "Terdaftar" : "Tidak terdaftar"} />
              {waResult.jid && <InfoRow icon={<User className="w-4 h-4" />} label="JID" value={waResult.jid} mono />}
              {waResult.profilePic && (
                <div className="flex items-start gap-3">
                  <Image className="w-4 h-4 mt-0.5 text-muted shrink-0" />
                  <div>
                    <div className="text-muted text-xs mb-1">Foto Profil</div>
                    <img src={waResult.profilePic} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Check */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <List className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold">Bulk WhatsApp Checker</h3>
          </div>
          <div className="space-y-3">
            <textarea
              value={bulkNumbers}
              onChange={(e) => setBulkNumbers(e.target.value)}
              placeholder={"Masukkan nomor (satu per baris atau pisahkan dengan koma):\n6281234567890\n6289876543210"}
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none font-[family-name:var(--font-jetbrains-mono)]"
            />
            <Button onClick={handleBulkCheck} disabled={bulkLoading || !bulkNumbers.trim()}>
              {bulkLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress.checked}/{bulkProgress.total}</>
              ) : (
                <><Search className="w-4 h-4" /> Cek Semua</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Results */}
      {bulkResults.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                Hasil Bulk ({bulkResults.filter((r) => r.data?.exists).length}/{bulkResults.length} terdaftar)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Nomor</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {bulkResults.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-muted text-xs">{i + 1}</td>
                      <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs">{r.number}</td>
                      <td className="py-2">
                        {r.data ? (
                          <Badge variant={r.data.exists ? "success" : "error"}>
                            {r.data.exists ? "Terdaftar" : "Tidak"}
                          </Badge>
                        ) : (
                          <Badge variant="default">Error</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted shrink-0">{icon}</span>
      <span className="text-muted min-w-[100px]">{label}</span>
      <span className={mono ? "font-[family-name:var(--font-jetbrains-mono)] text-xs" : ""}>{value}</span>
    </div>
  );
}
