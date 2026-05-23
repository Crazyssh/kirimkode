import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["next"],

  turbopack: {
    resolveAlias: {
      "../build/polyfills/polyfill-module":
        "./src/lib/modern-polyfill.js",
      "next/dist/build/polyfills/polyfill-module":
        "./src/lib/modern-polyfill.js",
    },
  },

  experimental: {
    cssChunking: "strict",
    optimizeCss: true,
  },

  images: {
    formats: ["image/webp", "image/avif"],
  },

  compress: true,

  // Subdomain api.kirimkode.com → /api/v1/*
  // Customer pakai: https://api.kirimkode.com/v1/balance
  // Internal route: /api/v1/balance
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: "/api/v1/:path*",
        has: [{ type: "host", value: "api.kirimkode.com" }],
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // CORS untuk public API — biar client browser pihak ke-3 bisa call
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, X-API-Key, Authorization",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.google-analytics.com https://challenges.cloudflare.com https://cloudflareinsights.com; frame-src https://challenges.cloudflare.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
