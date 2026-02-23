import type { Metadata } from "next";
import { BlogListContent } from "@/components/blog/blog-list-content";

export const metadata: Metadata = {
  title: "Blog - Tips, Tutorial & Panduan Nomor Virtual OTP",
  description:
    "Baca artikel terbaru seputar nomor virtual, verifikasi OTP, tips keamanan digital, dan panduan lengkap menggunakan layanan KirimKode.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog KirimKode - Tips & Panduan Nomor Virtual OTP",
    description:
      "Artikel terbaru seputar nomor virtual, verifikasi OTP, dan keamanan digital.",
    url: "/blog",
  },
};

export default function BlogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "KirimKode Blog",
    url: "https://kirimkode.com/blog",
    description:
      "Tips, tutorial, dan panduan seputar nomor virtual OTP.",
    publisher: {
      "@type": "Organization",
      name: "KirimKode",
      url: "https://kirimkode.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogListContent />
    </>
  );
}
