import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KirimKode - Nomor Virtual OTP Instan | Verifikasi Cepat & Aman",
    template: "%s | KirimKode",
  },
  description:
    "Platform nomor virtual #1 untuk verifikasi OTP WhatsApp, Telegram, Facebook, dan 200+ layanan lainnya. Mulai dari Rp 1.200/nomor. Cepat, aman, terjangkau.",
  keywords: [
    "OTP",
    "nomor virtual",
    "verifikasi OTP",
    "virtual number",
    "SMS verification",
    "WhatsApp OTP",
    "Telegram OTP",
    "beli nomor virtual",
    "nomor virtual murah",
    "OTP Indonesia",
  ],
  metadataBase: new URL("https://kirimkode.com"),
  alternates: {
    canonical: "/",
    languages: {
      "id-ID": "/",
      "en-US": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    alternateLocale: "en_US",
    url: "https://kirimkode.com",
    siteName: "KirimKode",
    title: "KirimKode - Nomor Virtual OTP Instan | Verifikasi Cepat & Aman",
    description:
      "Platform nomor virtual #1 untuk verifikasi OTP WhatsApp, Telegram, Facebook, dan 200+ layanan. Mulai dari Rp 1.200/nomor.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KirimKode - Platform Nomor Virtual OTP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KirimKode - Nomor Virtual OTP Instan",
    description:
      "Platform nomor virtual #1 untuk verifikasi OTP WhatsApp, Telegram, Facebook, dan 200+ layanan. Mulai dari Rp 1.200/nomor.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
