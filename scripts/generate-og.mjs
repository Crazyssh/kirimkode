import sharp from "sharp";

const width = 1200;
const height = 630;

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#09090b"/>
      <stop offset="100%" style="stop-color:#18181b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="900" cy="150" r="300" fill="#6366f1" opacity="0.06"/>
  <circle cx="200" cy="500" r="250" fill="#8b5cf6" opacity="0.05"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="${width}" height="4" fill="url(#accent)"/>

  <!-- Logo/Brand -->
  <text x="80" y="120" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#6366f1">
    ⚡ KirimKode
  </text>

  <!-- Main Title -->
  <text x="80" y="240" font-family="Arial, sans-serif" font-size="58" font-weight="bold" fill="#fafafa">
    Nomor Virtual OTP
  </text>
  <text x="80" y="310" font-family="Arial, sans-serif" font-size="58" font-weight="bold" fill="#6366f1">
    Instan &amp; Aman
  </text>

  <!-- Description -->
  <text x="80" y="390" font-family="Arial, sans-serif" font-size="24" fill="#a1a1aa">
    Verifikasi WhatsApp, Telegram, Facebook &amp; 200+ layanan.
  </text>
  <text x="80" y="425" font-family="Arial, sans-serif" font-size="24" fill="#a1a1aa">
    Mulai dari Rp 1.200/nomor. Bayar per OTP.
  </text>

  <!-- Stats boxes -->
  <rect x="80" y="480" width="180" height="80" rx="12" fill="#18181b" stroke="#27272a" stroke-width="1"/>
  <text x="170" y="515" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#6366f1" text-anchor="middle">200+</text>
  <text x="170" y="545" font-family="Arial, sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Negara</text>

  <rect x="280" y="480" width="180" height="80" rx="12" fill="#18181b" stroke="#27272a" stroke-width="1"/>
  <text x="370" y="515" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#6366f1" text-anchor="middle">500+</text>
  <text x="370" y="545" font-family="Arial, sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Layanan</text>

  <rect x="480" y="480" width="180" height="80" rx="12" fill="#18181b" stroke="#27272a" stroke-width="1"/>
  <text x="570" y="515" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#6366f1" text-anchor="middle">10K+</text>
  <text x="570" y="545" font-family="Arial, sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Pengguna</text>

  <!-- URL -->
  <text x="1120" y="590" font-family="Arial, sans-serif" font-size="20" fill="#52525b" text-anchor="end">kirimkode.com</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-image.png");
console.log("OG image generated: public/og-image.png (1200x630)");
