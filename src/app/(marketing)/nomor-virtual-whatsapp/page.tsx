import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { UseCaseContent } from "@/components/landing/use-case-content";


export const metadata: Metadata = {
  title: "Nomor Virtual untuk Verifikasi WhatsApp — Aman & Instan",
  description:
    "Beli nomor virtual untuk verifikasi WhatsApp dari 200+ negara. Harga mulai Rp 1.500, refund otomatis jika OTP gagal. Cepat, aman, terjangkau.",
  keywords: [
    "nomor virtual whatsapp",
    "verifikasi whatsapp tanpa nomor hp",
    "virtual number whatsapp",
    "otp whatsapp",
    "beli nomor whatsapp",
  ],
  alternates: { canonical: "/nomor-virtual-whatsapp" },
  openGraph: {
    title: "Nomor Virtual WhatsApp — Verifikasi Tanpa Nomor Pribadi",
    description:
      "Nomor virtual dari 200+ negara untuk verifikasi WhatsApp. Harga mulai Rp 1.500. Refund otomatis.",
    url: "/nomor-virtual-whatsapp",
  },
};

const useCaseData = {
  badge: "WhatsApp Verification",
  headline: "Verifikasi WhatsApp Tanpa",
  headlineHighlight: "Nomor Pribadi",
  subheadline:
    "KirimKode menyediakan nomor virtual dari 200+ negara untuk verifikasi akun WhatsApp secara aman. Cocok untuk bisnis, privasi, dan testing.",
  ctaText: "Beli Nomor WhatsApp",
  sellingPoints: [
    {
      icon: "Globe",
      title: "200+ Negara Tersedia",
      description:
        "Pilih nomor virtual dari Indonesia, Amerika, India, Rusia, dan 200+ negara lainnya untuk verifikasi WhatsApp.",
    },
    {
      icon: "Zap",
      title: "OTP Instan",
      description:
        "Kode verifikasi WhatsApp masuk ke dashboard dalam hitungan detik setelah request dikirim.",
    },
    {
      icon: "CreditCard",
      title: "Harga Terjangkau",
      description:
        "Nomor virtual WhatsApp mulai dari Rp 1.500. Tidak ada biaya langganan, bayar per kebutuhan.",
    },
    {
      icon: "Shield",
      title: "Privasi Terjamin",
      description:
        "Nomor pribadi Anda tetap aman. Gunakan nomor virtual untuk memisahkan akun bisnis dan personal.",
    },
    {
      icon: "Clock",
      title: "Refund Otomatis",
      description:
        "Jika OTP WhatsApp tidak masuk dalam 20 menit, saldo Anda otomatis dikembalikan.",
    },
    {
      icon: "MessageSquare",
      title: "WhatsApp Business Ready",
      description:
        "Bisa digunakan untuk WhatsApp biasa maupun WhatsApp Business. Cocok untuk multi-akun bisnis.",
    },
  ],
  steps: [
    {
      number: "1",
      title: "Top Up Saldo",
      description:
        "Daftar dan top up saldo mulai Rp 5.000 via QRIS. Support semua e-wallet dan bank.",
    },
    {
      number: "2",
      title: "Beli Nomor WhatsApp",
      description:
        'Pilih layanan "WhatsApp", pilih negara, dan klik beli. Nomor virtual siap dalam hitungan detik.',
    },
    {
      number: "3",
      title: "Terima & Masukkan OTP",
      description:
        "Masukkan nomor virtual ke WhatsApp. Kode OTP muncul di dashboard KirimKode, salin dan verifikasi.",
    },
  ],
  faqs: [
    {
      q: "Apakah nomor virtual bisa digunakan untuk WhatsApp Business?",
      a: "Ya, nomor virtual KirimKode bisa digunakan untuk verifikasi WhatsApp biasa maupun WhatsApp Business.",
    },
    {
      q: "Berapa lama nomor virtual aktif?",
      a: "Nomor virtual aktif selama 20 menit untuk menerima OTP. Setelah itu, nomor expired dan saldo di-refund jika OTP tidak masuk.",
    },
    {
      q: "Bagaimana jika OTP WhatsApp tidak masuk?",
      a: "Saldo Anda otomatis di-refund dalam 20 menit. Anda bisa mencoba nomor dari negara lain.",
    },
    {
      q: "Apakah bisa digunakan untuk banyak akun WhatsApp?",
      a: "Ya, Anda bisa membeli nomor virtual sebanyak yang dibutuhkan. Setiap nomor bisa digunakan untuk satu akun WhatsApp.",
    },
  ],
  relatedBlog: [
    {
      title: "Cara Verifikasi WhatsApp Tanpa Nomor HP",
      slug: "cara-verifikasi-whatsapp-tanpa-nomor-hp",
    },
    {
      title: "5 Cara Menjaga Privasi Nomor HP Saat Daftar Online",
      slug: "cara-menjaga-privasi-nomor-hp",
    },
  ],
};

export default function WhatsAppLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nomor Virtual WhatsApp — KirimKode",
    description:
      "Nomor virtual untuk verifikasi akun WhatsApp dari 200+ negara. Harga mulai Rp 1.500.",
    brand: { "@type": "Brand", name: "KirimKode" },
    offers: {
      "@type": "Offer",
      price: "1500",
      priceCurrency: "IDR",
      availability: "https://schema.org/InStock",
      url: "https://kirimkode.com/nomor-virtual-whatsapp",
    },
    url: "https://kirimkode.com/nomor-virtual-whatsapp",
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <UseCaseContent data={useCaseData} />
      <Footer />
    </div>
  );
}
