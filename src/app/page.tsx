import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { HomeContent } from "@/components/landing/home-content";

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "KirimKode",
        url: "https://kirimkode.com",
        description:
          "Platform nomor virtual #1 untuk verifikasi OTP WhatsApp, Telegram, Facebook, dan 200+ layanan lainnya.",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://kirimkode.com/buy?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        name: "KirimKode",
        url: "https://kirimkode.com",
        logo: "https://kirimkode.com/favicon.ico",
        description:
          "Platform penyedia nomor virtual terpercaya di Indonesia untuk verifikasi OTP berbagai layanan.",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Customer Support",
          email: "support@kirimkode.com",
          availableLanguage: ["Indonesian", "English"],
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Apa itu KirimKode?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "KirimKode adalah platform penyedia nomor virtual untuk menerima kode OTP dari berbagai layanan seperti WhatsApp, Telegram, Facebook, dan 200+ layanan lainnya.",
            },
          },
          {
            "@type": "Question",
            name: "Berapa harga nomor virtual?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Harga mulai dari Rp 1.200 per nomor, tergantung layanan dan negara yang dipilih. Tidak ada biaya langganan, bayar hanya saat butuh.",
            },
          },
          {
            "@type": "Question",
            name: "Apakah aman menggunakan KirimKode?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Ya, KirimKode menggunakan enkripsi end-to-end dan nomor virtual yang digunakan bersifat sementara sehingga privasi Anda tetap terjaga.",
            },
          },
          {
            "@type": "Question",
            name: "Metode pembayaran apa yang tersedia?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Kami menerima pembayaran melalui QRIS yang mendukung semua e-wallet dan bank di Indonesia. Deposit minimum hanya Rp 5.000.",
            },
          },
          {
            "@type": "Question",
            name: "Bagaimana jika OTP tidak masuk?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Jika OTP tidak masuk dalam 20 menit, saldo Anda akan otomatis dikembalikan (refund). Tidak ada risiko kehilangan uang.",
            },
          },
        ],
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
      <HomeContent />
      <Footer />
    </div>
  );
}
