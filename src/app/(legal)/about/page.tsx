import type { Metadata } from "next";
import { AboutContent } from "@/components/legal/about-content";

export const metadata: Metadata = {
  title: "Tentang KirimKode - Platform Nomor Virtual OTP Terpercaya",
  description:
    "Pelajari tentang KirimKode, platform penyedia nomor virtual terkemuka di Indonesia. 200+ negara, 500+ layanan, 10.000+ pengguna. Cepat, aman, terjangkau.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "Tentang KirimKode - Platform Nomor Virtual OTP Terpercaya",
    description:
      "Platform penyedia nomor virtual terkemuka di Indonesia untuk verifikasi OTP. 200+ negara, 10.000+ pengguna aktif.",
    url: "/about",
  },
};

export default function AboutPage() {
  return <AboutContent />;
}
