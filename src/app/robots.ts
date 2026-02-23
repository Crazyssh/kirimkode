import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api", "/auth", "/buy", "/deposit", "/history", "/settings"],
      },
    ],
    sitemap: "https://kirimkode.com/sitemap.xml",
  };
}
