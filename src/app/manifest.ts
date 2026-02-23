import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KirimKode - Nomor Virtual OTP Instan",
    short_name: "KirimKode",
    description:
      "Platform nomor virtual untuk verifikasi OTP WhatsApp, Telegram, Facebook, dan 200+ layanan lainnya. Cepat, aman, dan terjangkau.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#6366f1",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
