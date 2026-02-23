import type { Metadata } from "next";
import { ContactContent } from "@/components/legal/contact-content";

export const metadata: Metadata = {
  title: "Hubungi Kami - KirimKode Support",
  description:
    "Butuh bantuan? Hubungi tim KirimKode via email support@kirimkode.com atau WhatsApp. Jam operasional Senin-Jumat 09:00-21:00 WIB.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Hubungi Kami - KirimKode Support",
    description:
      "Hubungi tim KirimKode untuk bantuan teknis, pertanyaan, atau kerjasama bisnis.",
    url: "/contact",
  },
};

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Hubungi KirimKode",
    url: "https://kirimkode.com/contact",
    mainEntity: {
      "@type": "Organization",
      name: "KirimKode",
      email: "support@kirimkode.com",
      telephone: "+62-812-3456-7890",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Jakarta",
        addressCountry: "ID",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ContactContent />
    </>
  );
}
