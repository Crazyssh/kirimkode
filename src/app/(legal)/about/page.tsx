import { Card, CardContent } from "@/components/ui/card";
import { Zap, Shield, Users, Globe } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
          Tentang <span className="text-primary">KirimKode</span>
        </h1>
        <p className="text-muted">
          KirimKode adalah platform penyedia nomor virtual terkemuka di Indonesia untuk kebutuhan verifikasi OTP. Kami membantu ribuan pengguna dan developer mendapatkan nomor sementara dari 200+ negara dengan cepat, aman, dan harga terjangkau.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)]">Misi Kami</h2>
        <p className="text-muted text-sm">
          Menyediakan layanan nomor virtual yang mudah diakses, terpercaya, dan terjangkau untuk semua orang. Kami percaya bahwa privasi digital adalah hak setiap orang, dan nomor virtual adalah salah satu cara untuk melindunginya.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: Zap, title: "Cepat", desc: "OTP masuk dalam hitungan detik setelah pembelian nomor." },
          { icon: Shield, title: "Aman", desc: "Data pengguna terenkripsi dan nomor bersifat sementara." },
          { icon: Users, title: "10.000+ Pengguna", desc: "Dipercaya oleh ribuan pengguna dan developer di Indonesia." },
          { icon: Globe, title: "200+ Negara", desc: "Nomor virtual tersedia dari berbagai negara di dunia." },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent>
              <item.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-muted">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)]">Teknologi</h2>
        <p className="text-muted text-sm">
          KirimKode dibangun dengan teknologi modern — Next.js, React, dan infrastruktur cloud yang handal. Kami terintegrasi dengan beberapa provider SMS internasional untuk memastikan ketersediaan nomor yang tinggi dan pengiriman OTP yang cepat.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-[family-name:var(--font-space-grotesk)]">API untuk Developer</h2>
        <p className="text-muted text-sm">
          Kami menyediakan REST API lengkap agar developer bisa mengintegrasikan layanan nomor virtual ke dalam aplikasi mereka. Dokumentasi lengkap tersedia di halaman API Docs setelah mendaftar.
        </p>
      </div>

      <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
        <h3 className="font-bold mb-2">Hubungi Kami</h3>
        <p className="text-sm text-muted">
          Punya pertanyaan atau ingin kerjasama? Hubungi kami melalui email di{" "}
          <a href="mailto:support@kirimkode.com" className="text-primary hover:underline">support@kirimkode.com</a>{" "}
          atau melalui halaman <a href="/contact" className="text-primary hover:underline">Kontak</a>.
        </p>
      </div>
    </div>
  );
}
