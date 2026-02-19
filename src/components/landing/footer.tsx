import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-bold font-[family-name:var(--font-space-grotesk)]">
                Kirim<span className="text-primary">Kode</span>
              </span>
            </div>
            <p className="text-sm text-muted">
              Platform nomor virtual terpercaya untuk verifikasi OTP instan.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Layanan</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#" className="hover:text-foreground transition-colors">WhatsApp OTP</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Telegram OTP</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Facebook OTP</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Instagram OTP</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Perusahaan</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="/about" className="hover:text-foreground transition-colors">Tentang Kami</a></li>
              <li><a href="/api-docs" className="hover:text-foreground transition-colors">API Docs</a></li>
              <li><a href="/contact" className="hover:text-foreground transition-colors">Kontak</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="/terms" className="hover:text-foreground transition-colors">Syarat & Ketentuan</a></li>
              <li><a href="/privacy" className="hover:text-foreground transition-colors">Kebijakan Privasi</a></li>
              <li><a href="/refund" className="hover:text-foreground transition-colors">Refund Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted">
            &copy; 2026 KirimKode. Semua hak dilindungi.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span>200+ negara</span>
            <span className="text-border">|</span>
            <span>500+ layanan</span>
            <span className="text-border">|</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
