"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { AlertCircle, Info, CheckCircle, X, MailWarning, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguageStore } from "@/store/language";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useLanguageStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);

  useEffect(() => {
    async function checkUserAndAnnouncements() {
      try {
        // Cek status banned
        const meRes = await fetch("/api/user/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.data?.status === "banned") {
            router.replace("/banned");
            return;
          }
          // Status verifikasi email (untuk banner peringatan).
          setEmailVerified(!!meData.data?.emailVerified);
        }

        // Fetch announcements
        const res = await fetch("/api/announcements");
        if (res.ok) {
          const json = await res.json();
          setAnnouncements(json.data || []);
        }
      } catch { /* silent */ }
    }
    checkUserAndAnnouncements();
  }, [router]);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));
  const showVerifyBanner = emailVerified === false && !verifyBannerDismissed;

  const handleSendVerify = async () => {
    setSendingVerify(true);
    try {
      const res = await fetch("/api/user/verify-email/request", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || t("emailVerify.requestSent"));
      } else {
        toast.error(data?.error?.message || t("resetPassword.tryAgain"));
        if (data?.error?.code === "ALREADY_VERIFIED") setEmailVerified(true);
      }
    } catch {
      toast.error(t("auth.networkError"));
    } finally {
      setSendingVerify(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Email verification warning */}
        {showVerifyBanner && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border bg-warning/10 border-warning/30 text-warning text-sm">
              <MailWarning className="w-4 h-4 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{t("emailVerify.bannerTitle")}</div>
                <div className="text-xs opacity-80">{t("emailVerify.bannerDesc")}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSendVerify}
                  disabled={sendingVerify}
                  className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 hover:bg-warning/30 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {sendingVerify ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {t("emailVerify.bannerButton")}
                </button>
                <button
                  onClick={() => setVerifyBannerDismissed(true)}
                  className="opacity-60 hover:opacity-100"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Announcements */}
        {visibleAnnouncements.length > 0 && (
          <div className="px-4 sm:px-6 lg:px-8 pt-4 space-y-2">
            {visibleAnnouncements.map((a) => {
              const Icon = a.type === "warning" ? AlertCircle : a.type === "success" ? CheckCircle : Info;
              const colors = a.type === "warning" ? "bg-warning/10 border-warning/30 text-warning" : a.type === "success" ? "bg-success/10 border-success/30 text-success" : "bg-primary/10 border-primary/30 text-primary";
              return (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${colors}`}>
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs opacity-80">{a.content}</div>
                  </div>
                  <button onClick={() => setDismissed((prev) => new Set(prev).add(a.id))} className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <WhatsAppButton />
    </div>
  );
}
