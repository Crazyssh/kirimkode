import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { UseCaseContent } from "@/components/landing/use-case-content";


export const metadata: Metadata = {
  title: "Nomor Virtual untuk Verifikasi Shopee & Tokopedia",
  description:
    "Verifikasi akun Shopee dan Tokopedia aman dengan nomor virtual. Harga mulai Rp 1.200, instan, refund otomatis. Cocok untuk multi-toko.",
  keywords: [
    "nomor virtual shopee",
    "nomor virtual tokopedia",
    "verifikasi shopee",
    "verifikasi tokopedia",
    "multi toko marketplace",
    "otp shopee",
  ],
  alternates: { canonical: "/nomor-virtual-shopee-tokopedia" },
  openGraph: {
    title: "Nomor Virtual Shopee & Tokopedia — Verifikasi Aman",
    description:
      "Verifikasi akun marketplace aman & murah. Nomor virtual mulai Rp 1.200. Cocok untuk multi-toko.",
    url: "/nomor-virtual-shopee-tokopedia",
  },
};

const useCaseData = {
  badge: "Marketplace Verification",
  headline: "Verifikasi Akun Marketplace",
  headlineHighlight: "Aman & Murah",
  subheadline:
    "Nomor virtual dari KirimKode memudahkan verifikasi Shopee dan Tokopedia tanpa risiko privasi. Cocok untuk seller multi-toko dan buyer yang sadar privasi.",
  ctaText: "Beli Nomor Marketplace",
  sellingPoints: [
    {
      icon: "ShoppingCart",
      title: "Support Shopee & Tokopedia",
      description:
        "Nomor virtual yang kompatibel dengan kedua marketplace terbesar Indonesia. Verifikasi berhasil terjamin.",
    },
    {
      icon: "CreditCard",
      title: "Harga Mulai Rp 1.200",
      description:
        "Jauh lebih murah dari membeli SIM card baru. Bayar per nomor, tanpa langganan bulanan.",
    },
    {
      icon: "Zap",
      title: "Proses Instan",
      description:
        "Beli nomor dan terima OTP dalam hitungan detik. Langsung bisa mulai berjualan atau belanja.",
    },
    {
      icon: "Shield",
      title: "Privasi Terjaga",
      description:
        "Nomor pribadi Anda tidak tersebar di marketplace. Aman dari spam dan penyalahgunaan data.",
    },
    {
      icon: "Clock",
      title: "Refund Otomatis",
      description:
        "OTP tidak masuk dalam 20 menit? Saldo dikembalikan otomatis. Tidak ada risiko uang hilang.",
    },
    {
      icon: "Globe",
      title: "Nomor Indonesia",
      description:
        "Tersedia nomor Indonesia yang cocok untuk marketplace lokal. Juga tersedia nomor dari 200+ negara.",
    },
  ],
  steps: [
    {
      number: "1",
      title: "Top Up Saldo",
      description:
        "Daftar di KirimKode dan deposit saldo mulai Rp 5.000 via QRIS.",
    },
    {
      number: "2",
      title: "Beli Nomor Marketplace",
      description:
        'Pilih "Shopee" atau "Tokopedia" sebagai layanan, pilih negara Indonesia, dan beli nomor.',
    },
    {
      number: "3",
      title: "Verifikasi & Jualan",
      description:
        "Masukkan nomor ke marketplace, terima OTP di dashboard, dan mulai berjualan!",
    },
  ],
  faqs: [
    {
      q: "Apakah nomor virtual bisa untuk verifikasi seller Shopee?",
      a: "Ya, nomor virtual bisa digunakan untuk verifikasi akun seller maupun buyer di Shopee.",
    },
    {
      q: "Apakah aman untuk Tokopedia Official Store?",
      a: "Nomor virtual cocok untuk verifikasi akun biasa dan seller. Untuk Official Store, pastikan mengikuti persyaratan Tokopedia.",
    },
    {
      q: "Bisa buat berapa toko?",
      a: "Tidak ada batasan. Beli nomor virtual sebanyak yang dibutuhkan untuk setiap toko baru.",
    },
    {
      q: "Apakah nomor bisa digunakan ulang?",
      a: "Nomor virtual bersifat sekali pakai untuk menerima OTP. Untuk verifikasi baru, beli nomor baru.",
    },
  ],
  relatedBlog: [
    {
      title: "Nomor Virtual Murah untuk Verifikasi Shopee dan Tokopedia",
      slug: "nomor-virtual-verifikasi-shopee-tokopedia",
    },
    {
      title: "5 Cara Menjaga Privasi Nomor HP Saat Daftar Online",
      slug: "cara-menjaga-privasi-nomor-hp",
    },
  ],
  abTestName: "mp-cta",
  variantB: {
    headline: "Buka Toko Baru di",
    headlineHighlight: "Marketplace?",
    subheadline: "Nomor virtual mulai Rp 1.200 untuk verifikasi Shopee & Tokopedia. Instan, aman, dan refund otomatis jika OTP gagal.",
    ctaText: "Verifikasi Sekarang",
  },
};

export default function MarketplaceLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nomor Virtual Shopee & Tokopedia — KirimKode",
    description:
      "Nomor virtual untuk verifikasi akun Shopee dan Tokopedia. Mulai Rp 1.200, refund otomatis.",
    brand: { "@type": "Brand", name: "KirimKode" },
    offers: {
      "@type": "Offer",
      price: "1200",
      priceCurrency: "IDR",
      availability: "https://schema.org/InStock",
      url: "https://kirimkode.com/nomor-virtual-shopee-tokopedia",
    },
    url: "https://kirimkode.com/nomor-virtual-shopee-tokopedia",
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
