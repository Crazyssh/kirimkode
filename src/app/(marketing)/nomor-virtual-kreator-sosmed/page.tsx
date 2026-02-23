import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { UseCaseContent } from "@/components/landing/use-case-content";


export const metadata: Metadata = {
  title: "Nomor Virtual untuk Kreator Sosial Media — Privasi Aman",
  description:
    "Lindungi privasi kreator konten TikTok, Instagram, YouTube. Verifikasi akun sosial media dengan nomor virtual. Mulai Rp 1.200.",
  keywords: [
    "nomor virtual tiktok",
    "nomor virtual instagram",
    "verifikasi sosial media",
    "kreator konten",
    "multi akun sosmed",
    "privasi kreator",
  ],
  alternates: { canonical: "/nomor-virtual-kreator-sosmed" },
  openGraph: {
    title: "Nomor Virtual Kreator Sosmed — Fokus Berkarya, Privasi Aman",
    description:
      "Verifikasi akun TikTok, Instagram, YouTube tanpa nomor pribadi. Privasi aman. Mulai Rp 1.200.",
    url: "/nomor-virtual-kreator-sosmed",
  },
};

const useCaseData = {
  badge: "Social Media Creator",
  headline: "Fokus Berkarya,",
  headlineHighlight: "Privasi Aman",
  subheadline:
    "Nomor virtual KirimKode melindungi privasi kreator saat verifikasi akun sosial media. Cocok untuk TikTok, Instagram, YouTube, dan platform lainnya.",
  ctaText: "Jaga Privasi Saya",
  sellingPoints: [
    {
      icon: "Shield",
      title: "Anti-Doxxing",
      description:
        "Nomor pribadi Anda tidak terhubung ke akun publik. Lindungi identitas dari fans, hater, atau stalker.",
    },
    {
      icon: "Users",
      title: "Multi-Akun Sosmed",
      description:
        "Kelola akun untuk personal, brand, niche berbeda. Setiap akun dengan nomor unik.",
    },
    {
      icon: "Globe",
      title: "Semua Platform",
      description:
        "Support TikTok, Instagram, Facebook, Twitter/X, YouTube, Discord, dan 500+ platform lainnya.",
    },
    {
      icon: "Zap",
      title: "Setup Cepat",
      description:
        "Beli nomor dan verifikasi akun dalam hitungan menit. Tidak perlu ke konter beli SIM card.",
    },
    {
      icon: "Code",
      title: "API untuk Automasi",
      description:
        "Developer bisa menggunakan REST API untuk automasi pembuatan dan verifikasi akun.",
    },
    {
      icon: "Clock",
      title: "Garansi Refund",
      description:
        "OTP tidak masuk? Saldo otomatis dikembalikan dalam 20 menit. Zero risk.",
    },
  ],
  steps: [
    {
      number: "1",
      title: "Daftar & Top Up",
      description:
        "Buat akun KirimKode dan top up saldo mulai Rp 5.000 via QRIS.",
    },
    {
      number: "2",
      title: "Pilih Platform & Negara",
      description:
        "Pilih TikTok, Instagram, atau platform lain. Pilih negara dan beli nomor virtual.",
    },
    {
      number: "3",
      title: "Verifikasi & Berkarya",
      description:
        "Masukkan nomor ke platform, terima OTP di dashboard, dan mulai berkarya dengan aman!",
    },
  ],
  faqs: [
    {
      q: "Platform sosial media apa saja yang didukung?",
      a: "KirimKode mendukung TikTok, Instagram, Facebook, Twitter/X, YouTube, Discord, Snapchat, LinkedIn, dan 500+ platform lainnya.",
    },
    {
      q: "Apakah aman untuk akun kreator dengan banyak followers?",
      a: "Ya, justru kreator dengan banyak followers lebih disarankan menggunakan nomor virtual untuk melindungi privasi dari doxxing.",
    },
    {
      q: "Bisa untuk verifikasi Instagram Business?",
      a: "Ya, nomor virtual bisa digunakan untuk verifikasi akun Instagram personal maupun business/creator.",
    },
    {
      q: "Bagaimana jika nomor virtual expired?",
      a: "Nomor virtual aktif selama 20 menit untuk menerima OTP. Setelah verifikasi berhasil, akun sosmed Anda tetap aktif meskipun nomor expired.",
    },
  ],
  relatedBlog: [
    {
      title: "Nomor Virtual untuk Verifikasi Akun TikTok Kreator",
      slug: "nomor-virtual-tiktok-kreator",
    },
    {
      title: "5 Cara Menjaga Privasi Nomor HP Saat Daftar Online",
      slug: "cara-menjaga-privasi-nomor-hp",
    },
  ],
  abTestName: "creator-cta",
  variantB: {
    headline: "Nomor Virtual untuk",
    headlineHighlight: "Kreator Konten",
    subheadline: "Verifikasi TikTok, Instagram, YouTube tanpa nomor pribadi. Lindungi identitas Anda dari doxxing dan spam.",
    ctaText: "Lindungi Privasi Saya",
  },
};

export default function KreatorSosmedLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Nomor Virtual Kreator Sosial Media — KirimKode",
    description:
      "Layanan nomor virtual untuk verifikasi akun sosial media kreator konten. TikTok, Instagram, YouTube, dan lainnya.",
    provider: {
      "@type": "Organization",
      name: "KirimKode",
      url: "https://kirimkode.com",
    },
    offers: {
      "@type": "Offer",
      price: "1200",
      priceCurrency: "IDR",
      availability: "https://schema.org/InStock",
    },
    url: "https://kirimkode.com/nomor-virtual-kreator-sosmed",
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
