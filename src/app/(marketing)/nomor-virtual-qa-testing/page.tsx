import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { UseCaseContent } from "@/components/landing/use-case-content";


export const metadata: Metadata = {
  title: "Nomor Virtual untuk QA Testing Aplikasi OTP",
  description:
    "Solusi testing OTP tanpa SIM card untuk developer & QA tester. REST API untuk automasi, 200+ negara, refund otomatis. Mulai Rp 1.200.",
  keywords: [
    "testing otp",
    "qa testing nomor virtual",
    "virtual number for testing",
    "otp testing api",
    "simulasi otp",
    "developer tools",
  ],
  alternates: { canonical: "/nomor-virtual-qa-testing" },
  openGraph: {
    title: "Nomor Virtual QA Testing — Simulasi OTP Tanpa SIM Card",
    description:
      "Testing aplikasi OTP tanpa SIM card. REST API, 200+ negara, refund otomatis. Untuk developer & QA.",
    url: "/nomor-virtual-qa-testing",
  },
};

const useCaseData = {
  badge: "Developer & QA",
  headline: "Simulasi OTP Tanpa",
  headlineHighlight: "SIM Card",
  subheadline:
    "Lakukan pengujian aplikasi OTP dengan nomor virtual KirimKode yang fleksibel dan cepat. REST API untuk integrasi langsung ke test environment Anda.",
  ctaText: "Integrasikan API Sekarang",
  sellingPoints: [
    {
      icon: "Code",
      title: "REST API Lengkap",
      description:
        "API endpoint untuk beli nomor, terima OTP, dan cek status. Dokumentasi lengkap tersedia di halaman API Docs.",
    },
    {
      icon: "Globe",
      title: "Test Multi-Negara",
      description:
        "Uji OTP dari 200+ negara. Pastikan aplikasi Anda berjalan baik untuk user di mana saja.",
    },
    {
      icon: "Zap",
      title: "OTP Masuk Instan",
      description:
        "Kode verifikasi masuk dalam hitungan detik. Tidak perlu menunggu lama saat running test suite.",
    },
    {
      icon: "Clock",
      title: "Auto Refund",
      description:
        "Gagal terima OTP? Saldo otomatis kembali dalam 20 menit. Tidak ada biaya terbuang.",
    },
    {
      icon: "Shield",
      title: "Environment Isolation",
      description:
        "Pisahkan nomor testing dari production. Nomor virtual tidak terhubung ke data pribadi.",
    },
    {
      icon: "CreditCard",
      title: "Pay Per Use",
      description:
        "Bayar hanya saat butuh. Mulai dari Rp 1.200/nomor. Cocok untuk startup dan tim kecil.",
    },
  ],
  steps: [
    {
      number: "1",
      title: "Daftar & Dapatkan API Key",
      description:
        "Buat akun di KirimKode, top up saldo, dan dapatkan API key dari halaman API Docs.",
    },
    {
      number: "2",
      title: "Integrasikan ke Test Suite",
      description:
        "Gunakan API untuk membeli nomor virtual dan menerima OTP secara programmatic dalam test Anda.",
    },
    {
      number: "3",
      title: "Jalankan Test & Otomasi",
      description:
        "Run automated tests dengan nomor virtual. Integrasikan ke CI/CD pipeline (GitHub Actions, Jenkins, dll).",
    },
  ],
  faqs: [
    {
      q: "Apakah ada dokumentasi API?",
      a: "Ya, dokumentasi API lengkap tersedia di halaman API Docs setelah Anda login. Termasuk contoh request/response.",
    },
    {
      q: "Bisa digunakan untuk automated testing?",
      a: "Ya, REST API kami dirancang untuk automasi. Bisa diintegrasikan dengan framework testing apa saja — Jest, Playwright, Selenium, dll.",
    },
    {
      q: "Apakah ada rate limit?",
      a: "Rate limit disesuaikan dengan kebutuhan. Untuk kebutuhan tinggi, hubungi tim kami untuk paket enterprise.",
    },
    {
      q: "Support bahasa pemrograman apa saja?",
      a: "REST API bisa digunakan dari bahasa pemrograman apa saja — Python, Node.js, Go, PHP, Java, dll.",
    },
  ],
  relatedBlog: [
    {
      title: "Cara QA Testing Aplikasi OTP Tanpa SIM Card",
      slug: "qa-testing-aplikasi-otp-tanpa-sim",
    },
    {
      title: "Apa Itu Nomor Virtual? Pengertian & Cara Menggunakannya",
      slug: "apa-itu-nomor-virtual",
    },
  ],
};

export default function QATestingLandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Nomor Virtual QA Testing — KirimKode",
    description:
      "Layanan nomor virtual dengan REST API untuk QA testing aplikasi OTP. Untuk developer dan tester.",
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
    url: "https://kirimkode.com/nomor-virtual-qa-testing",
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
