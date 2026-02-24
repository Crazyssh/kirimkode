"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/store/user";
import { useLanguageStore } from "@/store/language";
import { toast } from "sonner";
import {
  User,
  Lock,
  Phone,
  Globe,
  Save,
  Clock,
  Loader2,
  CheckCircle,
  Moon,
  Sun,
  Gift,
  Copy,
  Users,
} from "lucide-react";

export default function SettingsPage() {
  const { user, fetchUser } = useUserStore();
  const { t } = useLanguageStore();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginHistory, setLoginHistory] = useState<{ id: string; createdAt: string; ip: string | null }[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  // Fetch webhook URL separately
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/user/me");
        if (res.ok) {
          const json = await res.json();
          setWebhookUrl(json.data?.webhookUrl || "");
        }
      } catch { /* silent */ }
    }
    fetchSettings();

    // Fetch login history
    async function fetchLoginHistory() {
      try {
        const res = await fetch("/api/user/login-history");
        if (res.ok) {
          const json = await res.json();
          setLoginHistory(json.data || []);
        }
      } catch { /* silent */ }
    }
    fetchLoginHistory();

    // Fetch referral
    async function fetchReferral() {
      try {
        const res = await fetch("/api/user/referral");
        if (res.ok) {
          const json = await res.json();
          setReferralCode(json.data?.referralCode || "");
          setReferralCount(json.data?.referralCount || 0);
        }
      } catch { /* silent */ }
    }
    fetchReferral();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, webhookUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Profil berhasil disimpan");
        fetchUser();
      } else {
        toast.error(data.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Password baru tidak sama");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password berhasil diubah");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Gagal mengubah password");
      }
    } catch {
      toast.error("Gagal mengubah password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted">{t("settings.desc")}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-primary" />
            {t("settings.profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">{t("settings.name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">{t("settings.email")}</label>
            <Input value={user?.email || ""} disabled className="opacity-60" />
            <span className="text-[10px] text-muted">{t("settings.emailCantChange")}</span>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" /> {t("settings.whatsapp")}
            </label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="628xxxxxxxxxx" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3" /> {t("settings.webhookUrl")}
            </label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
            <span className="text-[10px] text-muted">{t("settings.webhookDesc")}</span>
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("settings.saveProfile")}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4 text-primary" />
            {t("settings.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">{t("settings.oldPassword")}</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">{t("settings.newPassword")}</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">{t("settings.confirmPassword")}</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {t("settings.changePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="w-4 h-4 text-primary" />
            {t("settings.accountInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t("settings.role")}</span>
            <Badge variant={user?.role === "admin" ? "primary" : "success"}>{user?.role || "user"}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t("settings.apiKey")}</span>
            <span>{user?.apiKey ? t("settings.active") : t("settings.notCreated")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Referral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="w-4 h-4 text-primary" />
            {t("settings.referralProgram")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            {t("settings.referralDesc")}
          </p>
          {referralCode ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-background rounded-xl border border-border font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold text-primary">
                {referralCode}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  setCopiedRef(true);
                  setTimeout(() => setCopiedRef(false), 1500);
                }}
              >
                {copiedRef ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                {copiedRef ? t("common.copied") : t("common.copy")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Memuat kode referral...</p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted" />
            <span className="text-muted">{t("settings.friendsInvited")}</span>
            <span className="font-bold text-primary">{referralCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" />
            {t("settings.loginHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">{t("settings.noLoginHistory")}</p>
          ) : (
            <div className="space-y-2">
              {loginHistory.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-background/50 text-sm">
                  <span className="text-muted">
                    {new Date(log.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-muted">
                    {log.ip || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
