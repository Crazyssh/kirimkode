# KirimKode Brand Assets

## Konsep: Lightning Bolt + Keyhole (Unlock)
- **Petir (Zap)** = kecepatan pengiriman OTP
- **Keyhole** (negative space di tengah petir) = unlock access / verifikasi berhasil
- Konsisten dengan branding yang sudah ada (ikon Zap + tema security)

---

## Daftar File

| File | Ukuran | Kegunaan |
|------|--------|----------|
| `icon-512.svg` | 512x512 | Main brand mark, PWA icon besar |
| `icon-192.svg` | 192x192 | PWA manifest icon |
| `favicon.svg` | 32x32 | Browser favicon (simplified, tanpa keyhole) |
| `apple-touch-icon.svg` | 180x180 | iOS home screen icon |
| `logo-dark-bg.svg` | 520x120 | Full logo (icon + text) untuk background gelap |
| `logo-light-bg.svg` | 520x120 | Full logo (icon + text) untuk background terang |
| `og-image.svg` | 1200x630 | Social media preview (Open Graph) |

---

## Color Palette

| Nama | Hex | Kegunaan |
|------|-----|----------|
| Primary Green | `#00E676` | Bolt, accent, CTA |
| Primary Dark Green | `#00C853` | Gradient end |
| Emerald (Light mode) | `#059669` | Text accent di light bg |
| Background Dark | `#0F172A` | Icon background |
| Background Dark Alt | `#1A2744` | Gradient end |
| Surface | `#1E293B` | Card background |
| Border | `#334155` | Subtle borders |
| Text Light | `#E2E8F0` | Text di dark bg |
| Text Dark | `#1E293B` | Text di light bg |
| Accent Gold | `#FACC15` | Secondary accent |

---

## Typography

| Kegunaan | Font | Weight |
|----------|------|--------|
| Brand / Heading | Space Grotesk | 700 (Bold) |
| Body text | Inter | 400, 500, 600 |
| Code / Data | JetBrains Mono | 400, 500 |

---

## Cara Convert SVG ke PNG

### Dengan Sharp (Node.js)
```bash
npm install sharp
node -e "
const sharp = require('sharp');
sharp('icon-512.svg').resize(512,512).png().toFile('icon-512.png');
sharp('favicon.svg').resize(32,32).png().toFile('favicon-32x32.png');
sharp('favicon.svg').resize(16,16).png().toFile('favicon-16x16.png');
sharp('apple-touch-icon.svg').resize(180,180).png().toFile('apple-touch-icon.png');
sharp('icon-192.svg').resize(192,192).png().toFile('icon-192x192.png');
sharp('og-image.svg').resize(1200,630).png().toFile('og-image.png');
"
```

### Dengan Inkscape CLI
```bash
inkscape icon-512.svg -w 512 -h 512 -o icon-512.png
inkscape favicon.svg -w 32 -h 32 -o favicon-32x32.png
inkscape favicon.svg -w 16 -h 16 -o favicon-16x16.png
```

### Online Tool
- [SVG to PNG Converter](https://svgtopng.com/)
- [CloudConvert](https://cloudconvert.com/svg-to-png)

---

## Cara Generate .ico (favicon multi-size)

```bash
# Dengan ImageMagick
convert favicon-16x16.png favicon-32x32.png favicon.ico
```

---

## Catatan
- **Font rendering**: SVG text membutuhkan font terinstall. Jika font Space Grotesk tidak ada, fallback ke Inter/Segoe UI
- **Apple Touch Icon**: iOS akan auto-clip menjadi rounded corners, jadi tidak perlu rx pada SVG
- **PWA Maskable**: icon-192 dan icon-512 sudah safe area compatible (content dalam 80% center)
- **Semua file SVG** — scalable ke ukuran apapun tanpa pecah
