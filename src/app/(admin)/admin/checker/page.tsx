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
  XCircle,
  Image,
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

export default function AdminCheckerPage() {
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState<"wa" | "tg" | null>(null);
  const [waResult, setWaResult] = useState<WaResult | null>(null);
  const [tgResult, setTgResult] = useState<TgResult | null>(null);
  const [error, setError] = useState("");

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
        body: JSON.stringify({ number: number.trim(), platform }),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Number Checker
        </h1>
        <p className="text-sm text-muted">Cek status nomor di WhatsApp & Telegram</p>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <Input
                placeholder="Masukkan nomor telepon (contoh: 6281234567890)"
                className="pl-9 font-[family-name:var(--font-jetbrains-mono)]"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Result */}
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

        {/* Telegram Result */}
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

        {!waResult && !tgResult && !error && (
          <div className="col-span-full text-center py-12 text-muted">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Masukkan nomor dan klik Cek WA atau Cek TG</p>
          </div>
        )}
      </div>
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
