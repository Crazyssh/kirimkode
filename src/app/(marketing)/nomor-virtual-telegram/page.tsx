import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { UseCaseContent } from "@/components/landing/use-case-content";


export const metadata: Metadata = {
  title: "Nomor Virtual Telegram untuk Marketing & Multi-Akun",
  description:
    "Beli nomor virtual murah untuk verifikasi Telegram. Cocok untuk marketing, komunitas, dan multi-akun. Harga mulai Rp 1.200.",
  keywords: [
    "nomor virtual telegram",
    "verifikasi telegram",
    "banyak akun telegram",
    "telegram marketing",
    "otp telegram",
  ],
  alternates: { canonical: "/nomor-virtual-telegram" },
  openGraph: {
    title: "Nomor Virtual Telegram — Multi-Akun untuk Marketing",
    description:
      "Nomor virtual murah untuk Telegram. Buat banyak akun untuk marketing & komunitas. Mulai Rp 1.200.",
    url: "/nomor-virtual-telegram",
  },
};

const useCaseData = {
  badge: "Telegram Marketing",
  headline: "Multi-Akun Telegram untuk",
  headlineHighlight: "Bisnis & Komunitas",
  subheadline:
    "Gunakan KirimKode untuk membuat banyak akun Telegram tanpa nomor utama. Cocok untuk channel marketing, grup komunitas, dan customer support.",
  ctaText: "Beli Nomor Telegram",
  sellingPoints: [
    {
      icon: "Users",
      title: "Multi-Akun Mudah",
      description:
        "Buat banyak akun Telegram untuk brand, channel, dan komunitas berbeda. Setiap akun dengan nomor unik.",
    },
    {
      icon: "Zap",
      title: "Verifikasi Instan",
      description:
        "Nomor virtual siap dalam hitungan detik. OTP Telegram masuk langsung ke dashboard.",
    },
    {
      icon: "Globe",
      title: "Nomor dari 200+ Negara",
      description:
        "Pilih nomor dari Indonesia, Amerika, Eropa, atau Asia sesuai kebutuhan target audience.",
    },
    {
      icon: "Shield",
      title: "Aman & Private",
      description:
        "Nomor virtual terpisah dari nomor pribadi. Lindungi identitas tim marketing Anda.",
    },
    {
      icon: "Code",
      title: "REST API Tersedia",
      description:
        "Automasi pembuatan akun Telegram melalui REST API KirimKode. Cocok untuk developer dan automation tools.",
    },
    {
      icon: "Clock",
      title: "Refund Otomatis",
      description:
        "Jika OTP tidak masuk dalam 20 menit, saldo kembali otomatis. Zero risk.",
    },
  ],
  steps: [
    {
      number: "1",
      title: "Top Up Saldo",
      description:
        "Daftar dan deposit saldo mulai Rp 5.000 via QRIS. Semua bank dan e-wallet didukung.",
    },
    {
      number: "2",
      title: "Pilih Nomor Telegram",
      description:
        'Pilih layanan "Telegram" dan negara yang diinginkan. Harga mulai Rp 1.200/nomor.',
    },
    {
      number: "3",
      title: "Verifikasi & Mulai",
      description:
        "Masukkan nomor ke Telegram, terima OTP di dashboard KirimKode, dan akun siap digunakan.",
    },
  ],
  faqs: [
    {
      q: "Berapa harga nomor virtual untuk Telegram?",
      a: "Harga nomor virtual Telegram mulai dari Rp 1.200 per nomor, tergantung negara yang dipilih.",
    },
    {
      q: "Bisa buat berapa banyak akun Telegram?",
      a: "Tidak ada batasan. Anda bisa membeli nomor virtual sebanyak yang dibutuhkan untuk membuat akun Telegram.",
    },
    {
      q: "Apakah akun Telegram dari nomor virtual aman?",
      a: "Ya, akun yang dibuat berfungsi normal seperti akun biasa. Pastikan aktifkan 2FA untuk keamanan tambahan.",
    },
    {
      q: "Bisa digunakan untuk Telegram Bot?",
      a: "Ya, akun yang dibuat dengan nomor virtual bisa digunakan untuk membuat dan mengelola Telegram Bot.",
    },
  ],
  relatedBlog: [
    {
      title: "Cara Membuat Banyak Akun Telegram untuk Marketing",
      slug: "membuat-banyak-akun-telegram-marketing",
    },
    {
      title: "Bagaimana Nomor Virtual Membantu Digital Marketer",
      slug: "nomor-virtual-untuk-digital-marketer",
    },
  ],
  abTestName: "tg-cta",
  variantB: {
    headline: "Buat Akun Telegram",
    headlineHighlight: "Tanpa Batas",
    subheadline: "Nomor virtual mulai Rp 1.200 untuk verifikasi Telegram. Buat channel, grup, dan bot tanpa batasan nomor HP.",
    ctaText: "Mulai Buat Akun",
  },
};

export default function TelegramLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "Nomor Virtual Telegram — KirimKode",
        description:
          "Layanan nomor virtual untuk verifikasi akun Telegram. Cocok untuk marketing dan multi-akun.",
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
        url: "https://kirimkode.com/nomor-virtual-telegram",
      },
      {
        "@type": "FAQPage",
        mainEntity: useCaseData.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
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
