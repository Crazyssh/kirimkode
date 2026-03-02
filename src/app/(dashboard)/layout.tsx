"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { AlertCircle, Info, CheckCircle, X } from "lucide-react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const res = await fetch("/api/announcements");
        if (res.ok) {
          const json = await res.json();
          setAnnouncements(json.data || []);
        }
      } catch { /* silent */ }
    }
    fetchAnnouncements();
  }, []);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

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
