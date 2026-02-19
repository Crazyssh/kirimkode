"use client";

import { useEffect } from "react";
import { Menu } from "lucide-react";
import { useUserStore } from "@/store/user";

interface AdminTopbarProps {
  onMenuClick: () => void;
}

export function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const { user, fetchUser } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const displayName = user?.name || "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 glass border-b border-border flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-muted hover:text-foreground"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-semibold font-[family-name:var(--font-space-grotesk)] text-foreground">
          Admin Panel
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {user?.image ? (
          <img
            src={user.image}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {initial}
          </div>
        )}
        <div className="hidden sm:block">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-muted">{user?.email}</div>
        </div>
      </div>
    </header>
  );
}
