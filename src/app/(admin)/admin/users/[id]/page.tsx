"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Wallet,
  ShoppingCart,
  CreditCard,
  Loader2,
  Copy,
  CheckCircle,
} from "lucide-react";

interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  balance: number;
  role: string;
  status: string;
  banReason: string | null;
  apiKey: string | null;
  createdAt: string;
  _count: { orders: number; deposits: number };
  stats: { totalSpent: number; totalDeposited: number };
  recentOrders: { id: string; service: string; number: string; code: string | null; price: number; status: string; createdAt: string }[];
  recentDeposits: { id: string; amount: number; channel: string; status: string; createdAt: string }[];
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, copyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(copyId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/admin/users/${id}`);
        if (res.ok) {
          const json = await res.json();
          setUser(json.data);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-muted">
        <p>User tidak ditemukan</p>
        <Link href="/admin/users"><Button variant="ghost" className="mt-4"><ArrowLeft className="w-4 h-4" /> Kembali</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
            Detail User
          </h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      {/* Info User */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-primary" /> Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Nama</span>
              <span className="font-medium">{user.name || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Email</span>
              <span className="font-medium text-xs">{user.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">HP</span>
              <span>{user.phone || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Role</span>
              <Badge variant={user.role === "admin" ? "primary" : "default"}>{user.role}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Status</span>
              <Badge variant={user.status === "active" ? "success" : "error"}>{user.status}</Badge>
            </div>
            {user.banReason && (
              <div className="text-xs text-error bg-error/10 p-2 rounded-lg">Alasan ban: {user.banReason}</div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted">Daftar</span>
              <span className="text-xs">{new Date(user.createdAt).toLocaleDateString("id-ID")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Statistik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Saldo", value: formatRupiah(user.balance), icon: Wallet, color: "text-primary" },
                { label: "Total Order", value: String(user._count.orders), icon: ShoppingCart, color: "text-primary" },
                { label: "Total Deposit", value: formatRupiah(user.stats.totalDeposited), icon: CreditCard, color: "text-success" },
                { label: "Total Belanja", value: formatRupiah(user.stats.totalSpent), icon: ShoppingCart, color: "text-accent" },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-background/50 text-center">
                  <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
                  <div className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">{s.value}</div>
                  <div className="text-[10px] text-muted">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Riwayat Order ({user._count.orders})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.recentOrders.length === 0 ? (
            <p className="text-center text-muted text-sm py-4">Belum ada order</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Waktu</th>
                    <th className="pb-2 font-medium">Layanan</th>
                    <th className="pb-2 font-medium">Nomor</th>
                    <th className="pb-2 font-medium">OTP</th>
                    <th className="pb-2 font-medium">Harga</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {user.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border/50">
                      <td className="py-2 text-muted whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString("id-ID", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 font-medium">{o.service}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">{o.number}</span>
                          <button onClick={() => handleCopy(o.number, `n-${o.id}`)} className="text-muted hover:text-primary">
                            {copiedId === `n-${o.id}` ? <CheckCircle className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2">
                        {o.code ? (
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">{o.code}</span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">{formatRupiah(o.price)}</td>
                      <td className="py-2">
                        <Badge variant={o.status === "success" ? "success" : o.status === "waiting" ? "warning" : "error"}>
                          {o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary" />
            Riwayat Deposit ({user._count.deposits})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.recentDeposits.length === 0 ? (
            <p className="text-center text-muted text-sm py-4">Belum ada deposit</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Waktu</th>
                    <th className="pb-2 font-medium">Jumlah</th>
                    <th className="pb-2 font-medium">Metode</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {user.recentDeposits.map((d) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2 text-muted whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleString("id-ID", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 font-[family-name:var(--font-jetbrains-mono)] text-primary font-bold">{formatRupiah(d.amount)}</td>
                      <td className="py-2">{d.channel}</td>
                      <td className="py-2">
                        <Badge variant={d.status === "paid" ? "success" : d.status === "pending" ? "warning" : "error"}>
                          {d.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
