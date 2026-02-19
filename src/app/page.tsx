import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Zap,
  Shield,
  Globe,
  Clock,
  CreditCard,
  Code,
  MessageSquare,
  Send,
  Users,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  Wallet,
  ShoppingCart,
} from "lucide-react";

const stats = [
  { label: "Negara Tersedia", value: "200+", icon: Globe },
  { label: "Layanan Aktif", value: "500+", icon: MessageSquare },
  { label: "Pengguna Terdaftar", value: "10K+", icon: Users },
  { label: "OTP Terkirim", value: "1M+", icon: Send },
];

const features = [
  {
    icon: Zap,
    title: "OTP Instan",
    description: "Terima kode OTP dalam hitungan detik. Tidak perlu menunggu lama.",
  },
  {
    icon: Globe,
    title: "200+ Negara",
    description: "Nomor virtual dari berbagai negara di seluruh dunia.",
  },
  {
    icon: Shield,
    title: "Aman & Privat",
    description: "Nomor sementara yang melindungi privasi nomor pribadi Anda.",
  },
  {
    icon: CreditCard,
    title: "Harga Terjangkau",
    description: "Mulai dari Rp 500 per nomor. Deposit via QRIS, bank transfer, e-wallet.",
  },
  {
    icon: Code,
    title: "API Developer",
    description: "REST API lengkap untuk integrasi otomatis ke sistem Anda.",
  },
  {
    icon: Clock,
    title: "24/7 Online",
    description: "Layanan aktif 24 jam non-stop dengan uptime 99.9%.",
  },
];

const otpPrices = [
  { service: "WhatsApp", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1500, available: 342, popular: true },
  { service: "Telegram", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1200, available: 521, popular: true },
  { service: "Facebook", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2000, available: 189, popular: true },
  { service: "Instagram", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2500, available: 156, popular: false },
  { service: "TikTok", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1800, available: 278, popular: false },
  { service: "Google", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 3000, available: 67, popular: false },
  { service: "Twitter / X", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 2200, available: 94, popular: false },
  { service: "Discord", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1500, available: 445, popular: false },
  { service: "Shopee", country: "\ud83c\uddee\ud83c\udde9 Indonesia", price: 1200, available: 389, popular: false },
  { service: "WhatsApp", country: "\ud83c\uddfa\ud83c\uddf8 Amerika", price: 5250, available: 120, popular: false },
  { service: "Telegram", country: "\ud83c\uddfa\ud83c\uddf8 Amerika", price: 4200, available: 98, popular: false },
  { service: "WhatsApp", country: "\ud83c\uddee\ud83c\uddf3 India", price: 1200, available: 890, popular: false },
];

const howItWorks = [
  {
    step: "1",
    title: "Daftar & Deposit",
    description: "Buat akun gratis, lalu isi saldo mulai dari Rp 5.000 via QRIS.",
    icon: Wallet,
  },
  {
    step: "2",
    title: "Pilih Layanan",
    description: "Pilih negara dan aplikasi yang ingin diverifikasi (WA, FB, TG, dll).",
    icon: ShoppingCart,
  },
  {
    step: "3",
    title: "Terima Kode OTP",
    description: "Nomor virtual langsung muncul, tunggu OTP masuk dalam hitungan detik.",
    icon: MessageSquare,
  },
];

const faqs = [
  {
    q: "Apa itu nomor virtual OTP?",
    a: "Nomor virtual adalah nomor telepon sementara yang bisa menerima SMS OTP tanpa perlu SIM card fisik. Cocok untuk verifikasi akun tanpa menggunakan nomor pribadi.",
  },
  {
    q: "Berapa lama nomor aktif?",
    a: "Nomor aktif selama 20 menit setelah pembelian. Jika OTP belum masuk dalam waktu tersebut, saldo akan dikembalikan otomatis.",
  },
  {
    q: "Metode pembayaran apa saja?",
    a: "Kami menerima QRIS (semua e-wallet & mobile banking), transfer bank (BCA, BNI, BRI, Mandiri), dan e-wallet (DANA, OVO, GoPay).",
  },
  {
    q: "Apakah ada API untuk developer?",
    a: "Ya! Kami menyediakan REST API lengkap dengan dokumentasi. Anda bisa mengintegrasikan layanan kami ke sistem Anda sendiri.",
  },
  {
    q: "Bagaimana jika OTP tidak masuk?",
    a: "Jika OTP tidak masuk dalam 20 menit, saldo akan dikembalikan secara otomatis. Anda juga bisa membatalkan kapan saja sebelum OTP masuk.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="primary" className="mb-6">
              Platform #1 Nomor Virtual Indonesia
            </Badge>

            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold font-[family-name:var(--font-space-grotesk)] leading-tight mb-6">
              Verifikasi Akun{" "}
              <span className="gradient-text">Tanpa Ribet</span>
            </h1>

            <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
              Dapatkan nomor virtual dari 200+ negara untuk verifikasi WhatsApp,
              Telegram, Facebook, dan 500+ layanan lainnya. Cepat, aman, mulai
              dari Rp 500.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Mulai Sekarang <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="#fitur">
                <Button variant="secondary" size="lg">
                  Lihat Fitur
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {stats.map((stat) => (
                <Card key={stat.label} className="text-center py-4">
                  <CardContent>
                    <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                    <div className="text-lg sm:text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">
                      {stat.value}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Fitur</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Kenapa Pilih <span className="text-primary">KirimKode</span>?
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Semua yang Anda butuhkan untuk verifikasi nomor virtual dalam satu platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="hover:border-primary/30 transition-all duration-300 group"
              >
                <CardContent>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Services Preview */}
      <section id="layanan" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Layanan Populer</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              500+ Layanan Tersedia
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {[
              { name: "WhatsApp", color: "text-green-400" },
              { name: "Telegram", color: "text-blue-400" },
              { name: "Facebook", color: "text-blue-500" },
              { name: "Instagram", color: "text-pink-400" },
              { name: "TikTok", color: "text-foreground" },
              { name: "Twitter/X", color: "text-foreground" },
              { name: "Google", color: "text-red-400" },
              { name: "Discord", color: "text-indigo-400" },
              { name: "Shopee", color: "text-orange-400" },
              { name: "Tokopedia", color: "text-green-500" },
              { name: "Grab", color: "text-green-400" },
              { name: "DANA", color: "text-blue-400" },
            ].map((service) => (
              <Card key={service.name} className="text-center py-4 hover:border-primary/30 transition-all cursor-pointer">
                <CardContent>
                  <div className={`text-2xl mb-2 ${service.color} font-bold`}>
                    {service.name[0]}
                  </div>
                  <div className="text-xs text-muted">{service.name}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/register">
              <Button variant="secondary">
                Lihat Semua Layanan <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Cara Kerja Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Cara Kerja</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Semudah <span className="text-primary">3 Langkah</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 max-w-4xl mx-auto">
            {howItWorks.map((item, i) => (
              <Card key={item.step} className="relative text-center group hover:border-primary/30 transition-all">
                <CardContent>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-xs text-primary font-bold mb-2">LANGKAH {item.step}</div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted">{item.description}</p>
                </CardContent>
                {i < howItWorks.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/40" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Per OTP */}
      <section id="harga" className="py-20 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">Harga</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Bayar <span className="text-primary">Per OTP</span>
            </h2>
            <p className="text-muted">
              Tanpa langganan. Deposit saldo, beli sesuai kebutuhan. Mulai dari{" "}
              <span className="text-primary font-semibold">Rp 1.200</span> per nomor.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
            <Card className="text-center">
              <CardContent>
                <Wallet className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">Min. Deposit</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">Rp 5.000</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <CreditCard className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">Pembayaran</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">QRIS</div>
                <div className="text-xs text-muted">Semua e-wallet & bank</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent>
                <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="text-sm font-semibold">Refund Otomatis</div>
                <div className="text-xl font-bold font-[family-name:var(--font-space-grotesk)] text-primary">20 Menit</div>
                <div className="text-xs text-muted">Jika OTP tidak masuk</div>
              </CardContent>
            </Card>
          </div>

          {/* Price Table */}
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-3 font-medium">Layanan</th>
                      <th className="pb-3 font-medium">Negara</th>
                      <th className="pb-3 font-medium">Harga / OTP</th>
                      <th className="pb-3 font-medium">Stok</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {otpPrices.map((item, i) => (
                      <tr key={`${item.service}-${item.country}-${i}`} className="border-b border-border/50 hover:bg-background/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.service}</span>
                            {item.popular && <Badge variant="primary">Populer</Badge>}
                          </div>
                        </td>
                        <td className="py-3 text-muted">{item.country}</td>
                        <td className="py-3">
                          <span className="font-bold font-[family-name:var(--font-jetbrains-mono)] text-primary">
                            Rp {item.price.toLocaleString("id-ID")}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${item.available > 200 ? "bg-success" : item.available > 50 ? "bg-accent" : "bg-error"}`} />
                            <span className="text-muted">{item.available}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Link href="/register">
                            <Button size="sm" className="text-xs">Beli</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-center mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted mb-3">
                  Harga dapat berubah sewaktu-waktu tergantung ketersediaan. 500+ layanan tersedia di dashboard.
                </p>
                <Link href="/register">
                  <Button variant="secondary">
                    Lihat Semua Harga <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="primary" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Pertanyaan Umum
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <Card key={faq.q}>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <ChevronDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-2">{faq.q}</h4>
                      <p className="text-sm text-muted">{faq.a}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Siap <span className="gradient-text">Kirim Kode</span>?
          </h2>
          <p className="text-lg text-muted mb-8">
            Daftar sekarang dan dapatkan 5 OTP gratis untuk mencoba layanan kami.
          </p>
          <Link href="/register">
            <Button size="lg" className="animate-pulse-glow">
              Daftar Gratis Sekarang <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
