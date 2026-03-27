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
  Gift,
  Copy,
  Users,
  ShieldCheck,
  Send,
  RotateCcw,
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

  // Phone OTP states
  const [otpStep, setOtpStep] = useState<"idle" | "sent" | "verifying">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

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
        body: JSON.stringify({ name, webhookUrl }),
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

  const handleSendOtp = async () => {
    if (!phone) {
      toast.error("Masukkan nomor WhatsApp dulu");
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/user/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("settings.otpSent"));
        setOtpStep("sent");
        setOtpCode("");
        setOtpCountdown(60);
        fetchUser();
      } else {
        toast.error(data.error || "Gagal mengirim OTP");
      }
    } catch {
      toast.error("Gagal mengirim OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Kode OTP harus 6 digit");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/user/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Nomor berhasil diverifikasi!");
        setOtpStep("idle");
        setOtpCode("");
        fetchUser();
      } else {
        toast.error(data.error || "Gagal memverifikasi OTP");
      }
    } catch {
      toast.error("Gagal memverifikasi OTP");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleChangeNumber = () => {
    setOtpStep("idle");
    setOtpCode("");
    setPhone("");
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

      {/* Phone Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {t("settings.phoneVerification")}
            {user?.phoneVerified ? (
              <Badge variant="success" className="ml-auto">{t("settings.phoneVerified")}</Badge>
            ) : (
              <Badge variant="warning" className="ml-auto">{t("settings.phoneNotVerified")}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.phoneVerified ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-success/10 border border-success/30">
                <CheckCircle className="w-5 h-5 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium">{user.phone}</p>
                  <p className="text-xs text-muted">{t("settings.phoneVerified")}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={handleChangeNumber}>
                <RotateCcw className="w-3 h-3" />
                {t("settings.changeNumber")}
              </Button>
            </div>
          ) : otpStep === "sent" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30 text-sm">
                <Send className="w-4 h-4 text-primary shrink-0" />
                <span>{t("settings.otpSent")} ({phone})</span>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">{t("settings.enterOtp")}</label>
                <div className="flex gap-2">
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="font-[family-name:var(--font-jetbrains-mono)] text-lg tracking-[0.5em] text-center"
                  />
                  <Button onClick={handleVerifyOtp} disabled={otpVerifying || otpCode.length !== 6}>
                    {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {t("settings.verifyOtp")}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendOtp}
                  disabled={otpSending || otpCountdown > 0}
                >
                  {otpSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  {otpCountdown > 0
                    ? `${t("settings.resendOtp")} (${otpCountdown}s)`
                    : t("settings.resendOtp")}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleChangeNumber}>
                  {t("settings.changeNumber")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted">{t("settings.phoneRequired")}</p>
              <div>
                <label className="text-xs text-muted block mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {t("settings.whatsapp")}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="628xxxxxxxxxx"
                  />
                  <Button onClick={handleSendOtp} disabled={otpSending || !phone}>
                    {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t("settings.sendOtp")}
                  </Button>
                </div>
                <span className="text-[10px] text-muted">Format: 628xxxxxxxxxx</span>
              </div>
            </div>
          )}
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
