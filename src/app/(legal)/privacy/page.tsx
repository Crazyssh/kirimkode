import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi KirimKode. Pelajari bagaimana kami melindungi data pribadi Anda, penggunaan cookie, dan hak-hak pengguna.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Kebijakan Privasi - KirimKode",
    description:
      "Pelajari bagaimana KirimKode melindungi data pribadi dan privasi Anda.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
