"use client";

import { signOut } from "next-auth/react";
import { ShieldX, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Akun Diblokir
          </h1>
          <p className="text-muted text-sm">
            Akun Anda telah diblokir oleh admin. Anda tidak dapat mengakses layanan KirimKode.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-surface border border-border text-left space-y-2">
          <p className="text-sm text-muted">
            Jika Anda merasa ini adalah kesalahan, silakan hubungi admin melalui:
          </p>
          <a
            href="https://wa.me/6285183092627"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Mail className="w-4 h-4" />
            Hubungi Admin via WhatsApp
          </a>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
