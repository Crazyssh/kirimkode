import type { Metadata } from "next";
import { TermsContent } from "@/components/legal/terms-content";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat dan ketentuan penggunaan layanan KirimKode. Informasi tentang akun pengguna, pembayaran, penggunaan yang dilarang, dan batasan tanggung jawab.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Syarat & Ketentuan - KirimKode",
    description:
      "Baca syarat dan ketentuan penggunaan layanan nomor virtual KirimKode.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return <TermsContent />;
}
