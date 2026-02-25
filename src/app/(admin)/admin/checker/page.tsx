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
  Send,
  User,
  Clock,
  Calendar,
  Trash2,
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

interface TgResult {
  exists: boolean;
  deleted?: boolean;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: string | null;
  registeredAt?: string | null;
  profilePic?: string | null;
  lastSeen?: string | null;
  lastSeenLabel?: string | null;
  lastSeenTime?: string | null;
  number?: string;
  sessionUsed?: string;
}

interface BulkResultItem {
  number: string;
  platform: "wa" | "tg";
  data: WaResult | TgResult | null;
}

export default function AdminCheckerPage() {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState<"wa" | "tg" | null>(null);
  const [waResult, setWaResult] = useState<WaResult | null>(null);
  const [tgResult, setTgResult] = useState<TgResult | null>(null);
  const [error, setError] = useState("");

  // Bulk checker state
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkPlatform, setBulkPlatform] = useState<"wa" | "tg">("wa");
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

  const handleCheck = async (platform: "wa" | "tg") => {
    if (!number.trim()) return;
    setLoading(platform);
    setError("");
    if (platform === "wa") setWaResult(null);
    else setTgResult(null);

    try {
      const res = await fetch("/api/admin/checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: formatNumber(number.trim()), platform }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal mengecek nomor");
        return;
      }
      if (platform === "wa") setWaResult(json.data);
      else setTgResult(json.data);
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setLoading(null);
    }
  };

  const handleBulkCheck = async () => {
    const numbers = bulkNumbers
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
          body: JSON.stringify({ number: numbers[i], platform: bulkPlatform }),
        });
        const json = await res.json();
        results.push({
          number: numbers[i],
          platform: bulkPlatform,
          data: res.ok ? json.data : null,
        });
      } catch {
        results.push({ number: numbers[i], platform: bulkPlatform, data: null });
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
          Number Checker
        </h1>
        <p className="text-sm text-muted">Cek status nomor di WhatsApp & Telegram</p>
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
                onKeyDown={(e) => { if (e.key === "Enter") handleCheck("wa"); }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleCheck("wa")} disabled={!!loading || !number.trim()}>
                {loading === "wa" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Cek WA
              </Button>
              <Button variant="secondary" onClick={() => handleCheck("tg")} disabled={!!loading || !number.trim()}>
                {loading === "tg" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Cek TG
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Check Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {tgResult && (
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold">Telegram</h3>
                <Badge variant={tgResult.exists ? "success" : "error"}>
                  {tgResult.exists ? "Terdaftar" : "Tidak Terdaftar"}
                </Badge>
                {tgResult.deleted && <Badge variant="error">Dihapus</Badge>}
              </div>
              <div className="space-y-3 text-sm">
                <InfoRow icon={<CheckCircle className="w-4 h-4" />} label="Status" value={tgResult.exists ? "Terdaftar" : "Tidak terdaftar"} />
                {tgResult.username && <InfoRow icon={<User className="w-4 h-4" />} label="Username" value={`@${tgResult.username}`} mono />}
                {(tgResult.firstName || tgResult.lastName) && (
                  <InfoRow icon={<User className="w-4 h-4" />} label="Nama" value={`${tgResult.firstName || ""} ${tgResult.lastName || ""}`.trim()} />
                )}
                {tgResult.userId && <InfoRow icon={<User className="w-4 h-4" />} label="User ID" value={tgResult.userId} mono />}
                {tgResult.lastSeenLabel && <InfoRow icon={<Clock className="w-4 h-4" />} label="Terakhir Online" value={tgResult.lastSeenLabel} />}
                {tgResult.registeredAt && <InfoRow icon={<Calendar className="w-4 h-4" />} label="Terdaftar Sejak" value={tgResult.registeredAt} />}
                {tgResult.deleted !== undefined && (
                  <InfoRow icon={<Trash2 className="w-4 h-4" />} label="Akun Dihapus" value={tgResult.deleted ? "Ya" : "Tidak"} />
                )}
                {tgResult.profilePic && (
                  <div className="flex items-start gap-3">
                    <Image className="w-4 h-4 mt-0.5 text-muted shrink-0" />
                    <div>
                      <div className="text-muted text-xs mb-1">Foto Profil</div>
                      <img src={tgResult.profilePic} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk Check */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <List className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold">Bulk Checker</h3>
          </div>
          <div className="space-y-3">
            <textarea
              value={bulkNumbers}
              onChange={(e) => setBulkNumbers(e.target.value)}
              placeholder={"Masukkan nomor (satu per baris atau pisahkan dengan koma):\n6281234567890\n6289876543210"}
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none font-[family-name:var(--font-jetbrains-mono)]"
            />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setBulkPlatform("wa")}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    bulkPlatform === "wa"
                      ? "border-green-500 bg-green-500/10 text-green-400"
                      : "border-border hover:border-green-500/30 text-muted"
                  }`}
                >
                  <MessageCircle className="w-4 h-4 inline mr-1.5" />WhatsApp
                </button>
                <button
                  onClick={() => setBulkPlatform("tg")}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    bulkPlatform === "tg"
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-border hover:border-blue-500/30 text-muted"
                  }`}
                >
                  <Send className="w-4 h-4 inline mr-1.5" />Telegram
                </button>
              </div>
              <Button onClick={handleBulkCheck} disabled={bulkLoading || !bulkNumbers.trim()}>
                {bulkLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress.checked}/{bulkProgress.total}</>
                ) : (
                  <><Search className="w-4 h-4" /> Cek Semua</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Results */}
      {bulkResults.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                Hasil Bulk ({bulkResults.filter((r) => r.data && (r.data as WaResult | TgResult).exists).length}/{bulkResults.length} terdaftar)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Nomor</th>
                    <th className="pb-2 font-medium">Status</th>
                    {bulkPlatform === "tg" && (
                      <>
                        <th className="pb-2 font-medium">Username</th>
                        <th className="pb-2 font-medium">Nama</th>
                        <th className="pb-2 font-medium">Last Seen</th>
                        <th className="pb-2 font-medium">Terdaftar</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {bulkResults.map((r, i) => {
                    const tg = r.platform === "tg" ? (r.data as TgResult | null) : null;
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-muted text-xs">{i + 1}</td>
                        <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs">{r.number}</td>
                        <td className="py-2">
                          {r.data ? (
                            <Badge variant={(r.data as WaResult | TgResult).exists ? "success" : "error"}>
                              {(r.data as WaResult | TgResult).exists ? "Terdaftar" : "Tidak"}
                            </Badge>
                          ) : (
                            <Badge variant="default">Error</Badge>
                          )}
                        </td>
                        {bulkPlatform === "tg" && (
                          <>
                            <td className="py-2 text-xs font-[family-name:var(--font-jetbrains-mono)]">
                              {tg?.username ? `@${tg.username}` : "-"}
                            </td>
                            <td className="py-2 text-xs">
                              {tg?.firstName || tg?.lastName ? `${tg.firstName || ""} ${tg.lastName || ""}`.trim() : "-"}
                            </td>
                            <td className="py-2 text-xs">{tg?.lastSeenLabel || "-"}</td>
                            <td className="py-2 text-xs">{tg?.registeredAt || "-"}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
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
