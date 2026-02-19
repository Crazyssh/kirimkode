"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Edit3,
  X,
  Save,
  Ban,
  CheckCircle,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  balance: number;
  role: string;
  status: string;
  banReason: string | null;
  _count: { orders: number; deposits: number };
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editBalance, setEditBalance] = useState(0);
  const [editRole, setEditRole] = useState("user");
  const [editStatus, setEditStatus] = useState("active");
  const [editBanReason, setEditBanReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (res.ok) {
        setUsers(json.data);
        setPagination(json.pagination);
      } else {
        console.error("Admin users API error:", json);
      }
    } catch (err) { console.error("Admin users fetch error:", err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchUsers(1); }, [fetchUsers]);

  const openEditModal = (user: UserItem) => {
    setEditUser(user);
    setEditBalance(user.balance);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditBanReason(user.banReason || "");
    setEditError("");
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    setEditError("");

    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: editBalance,
          role: editRole,
          status: editStatus,
          banReason: editStatus === "banned" ? editBanReason : null,
        }),
      });

      if (res.ok) {
        setEditUser(null);
        fetchUsers(pagination.page);
      } else {
        const data = await res.json();
        setEditError(data.error || "Gagal menyimpan");
      }
    } catch {
      setEditError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (isoString: string) =>
    new Date(isoString).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          Manajemen Users
        </h1>
        <p className="text-sm text-muted">Kelola semua pengguna platform</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Cari nama atau email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">Nama</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Saldo</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Orders</th>
                      <th className="pb-3 font-medium">Bergabung</th>
                      <th className="pb-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b border-border/50 hover:bg-surface/30 transition-colors ${user.status === "banned" ? "opacity-60" : ""}`}
                      >
                        <td className="py-3 font-medium">
                          <a href={`/admin/users/${user.id}`} className="hover:text-primary transition-colors">
                            {user.name || "-"}
                          </a>
                        </td>
                        <td className="py-3 text-xs text-muted">{user.email}</td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs font-medium text-primary">
                          {formatRupiah(user.balance)}
                        </td>
                        <td className="py-3">
                          <Badge variant={user.role === "admin" ? "primary" : "default"}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={user.status === "active" ? "success" : "error"}>
                            {user.status === "active" ? "Aktif" : "Banned"}
                          </Badge>
                        </td>
                        <td className="py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                          {user._count?.orders ?? 0}
                        </td>
                        <td className="py-3 text-xs text-muted">{formatDate(user.createdAt)}</td>
                        <td className="py-3">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {users.length === 0 && (
                <div className="text-center py-12 text-muted">
                  <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada user ditemukan</p>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted">
                  Menampilkan {users.length} dari {pagination.total} user
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted">Halaman {pagination.page} dari {pagination.totalPages || 1}</span>
                  <Button variant="ghost" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div
            className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 space-y-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
                Edit User
              </h2>
              <button onClick={() => setEditUser(null)} className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-muted">
              <span className="font-medium text-foreground">{editUser.name || "No name"}</span>
              {" "}&middot;{" "}{editUser.email}
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-sm text-error">
                {editError}
              </div>
            )}

            {/* Saldo */}
            <div>
              <label className="text-sm text-muted mb-1.5 block">Saldo (IDR)</label>
              <Input
                type="number"
                value={editBalance}
                onChange={(e) => setEditBalance(Number(e.target.value))}
                className="font-[family-name:var(--font-jetbrains-mono)]"
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm text-muted mb-1.5 block">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Status (Ban/Unban) */}
            <div>
              <label className="text-sm text-muted mb-1.5 block">Status Akun</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditStatus("active")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    editStatus === "active"
                      ? "border-success bg-success/10 text-success"
                      : "border-border hover:border-success/30"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Aktif
                </button>
                <button
                  onClick={() => setEditStatus("banned")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    editStatus === "banned"
                      ? "border-error bg-error/10 text-error"
                      : "border-border hover:border-error/30"
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  Banned
                </button>
              </div>
            </div>

            {/* Ban Reason - only shown when banned */}
            {editStatus === "banned" && (
              <div className="animate-fade-in">
                <label className="text-sm text-muted mb-1.5 block">Alasan Ban</label>
                <textarea
                  value={editBanReason}
                  onChange={(e) => setEditBanReason(e.target.value)}
                  placeholder="Masukkan alasan ban..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted resize-none"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditUser(null)}>
                Batal
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
