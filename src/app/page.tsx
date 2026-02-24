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
      <main>
      <HomeContent />

      {/* Server-rendered SEO content — visible to crawlers without JS */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] mb-6 text-center">
            Nomor Virtual OTP Instan — <span className="text-primary">Verifikasi Cepat & Aman</span>
          </h2>
          <div className="space-y-4 text-sm text-muted leading-relaxed">
            <p>
              <strong>KirimKode</strong> adalah platform nomor virtual OTP terpercaya di Indonesia. Kami menyediakan nomor virtual dari lebih dari 200 negara untuk menerima kode verifikasi OTP dari 500+ layanan populer, termasuk WhatsApp, Telegram, Instagram, TikTok, Google, Facebook, Discord, Shopee, Tokopedia, dan masih banyak lagi.
            </p>
            <p>
              Dengan harga mulai dari <strong>Rp 1.200 per nomor</strong>, KirimKode menawarkan solusi verifikasi yang terjangkau tanpa biaya langganan. Anda hanya membayar saat membutuhkan nomor virtual — tidak ada komitmen bulanan. Jika OTP tidak masuk dalam 20 menit, saldo Anda akan <strong>otomatis dikembalikan</strong> tanpa proses manual.
            </p>
            <p>
              Platform kami dirancang untuk berbagai kebutuhan: <strong>developer</strong> yang membutuhkan nomor untuk QA testing aplikasi, <strong>digital marketer</strong> yang mengelola multi-akun sosial media, <strong>kreator konten</strong> yang ingin menjaga privasi, dan siapa saja yang membutuhkan verifikasi OTP tanpa menggunakan nomor HP pribadi.
            </p>
            <p>
              KirimKode juga menyediakan <strong>REST API</strong> lengkap dengan dokumentasi dan contoh kode dalam Node.js, Python, PHP, dan cURL. Developer bisa mengintegrasikan layanan nomor virtual langsung ke aplikasi mereka, CI/CD pipeline, atau automation tools.
            </p>
            <p>
              Pembayaran mudah melalui <strong>QRIS</strong> yang mendukung semua e-wallet dan bank di Indonesia, dengan deposit minimum hanya Rp 5.000. Daftar sekarang dan dapatkan nomor virtual pertama Anda dalam hitungan detik.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs text-muted">
            <div>
              <a href="/nomor-virtual-whatsapp" className="hover:text-foreground transition-colors">Nomor Virtual WhatsApp</a>
            </div>
            <div>
              <a href="/nomor-virtual-telegram" className="hover:text-foreground transition-colors">Nomor Virtual Telegram</a>
            </div>
            <div>
              <a href="/nomor-virtual-shopee-tokopedia" className="hover:text-foreground transition-colors">Verifikasi Shopee & Tokopedia</a>
            </div>
            <div>
              <a href="/nomor-virtual-kreator-sosmed" className="hover:text-foreground transition-colors">Nomor Virtual Kreator Sosmed</a>
            </div>
            <div>
              <a href="/nomor-virtual-qa-testing" className="hover:text-foreground transition-colors">QA Testing OTP</a>
            </div>
            <div>
              <a href="/blog" className="hover:text-foreground transition-colors">Blog & Panduan</a>
            </div>
            <div>
              <a href="/about" className="hover:text-foreground transition-colors">Tentang KirimKode</a>
            </div>
            <div>
              <a href="/contact" className="hover:text-foreground transition-colors">Hubungi Kami</a>
            </div>
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
