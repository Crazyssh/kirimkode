import type { Metadata } from "next";
import { RefundContent } from "@/components/legal/refund-content";

export const metadata: Metadata = {
  title: "Kebijakan Refund",
  description:
    "Kebijakan refund KirimKode. Refund otomatis dalam 20 menit jika OTP tidak masuk. Informasi lengkap tentang proses pengembalian saldo.",
  alternates: {
    canonical: "/refund",
  },
  openGraph: {
    title: "Kebijakan Refund - KirimKode",
    description:
      "Refund otomatis jika OTP tidak masuk dalam 20 menit. Baca kebijakan refund lengkap KirimKode.",
    url: "/refund",
  },
};

export default function RefundPage() {
  return <RefundContent />;
}
