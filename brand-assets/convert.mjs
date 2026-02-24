import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandDir = __dirname;
const publicDir = resolve(__dirname, "..", "public");
const appDir = resolve(__dirname, "..", "src", "app");

async function convert() {
  console.log("Converting brand assets...\n");

  // 1. favicon-32x32.png
  await sharp(resolve(brandDir, "favicon.svg"))
    .resize(32, 32)
    .png()
    .toFile(resolve(publicDir, "favicon-32x32.png"));
  console.log("  favicon-32x32.png");

  // 2. favicon-16x16.png
  await sharp(resolve(brandDir, "favicon.svg"))
    .resize(16, 16)
    .png()
    .toFile(resolve(publicDir, "favicon-16x16.png"));
  console.log("  favicon-16x16.png");

  // 3. apple-touch-icon.png (180x180)
  await sharp(resolve(brandDir, "apple-touch-icon.svg"))
    .resize(180, 180)
    .png()
    .toFile(resolve(publicDir, "apple-touch-icon.png"));
  console.log("  apple-touch-icon.png");

  // 4. icon-192x192.png (PWA)
  await sharp(resolve(brandDir, "icon-192.svg"))
    .resize(192, 192)
    .png()
    .toFile(resolve(publicDir, "icon-192x192.png"));
  console.log("  icon-192x192.png");

  // 5. icon-512x512.png (PWA)
  await sharp(resolve(brandDir, "icon-512.svg"))
    .resize(512, 512)
    .png()
    .toFile(resolve(publicDir, "icon-512x512.png"));
  console.log("  icon-512x512.png");

  // 6. Generate favicon.ico (contains 16x16 + 32x32)
  //    ICO format: simple BMP-in-ICO wrapper
  const png16 = await sharp(resolve(brandDir, "favicon.svg"))
    .resize(16, 16)
    .png()
    .toBuffer();
  const png32 = await sharp(resolve(brandDir, "favicon.svg"))
    .resize(32, 32)
    .png()
    .toBuffer();

  const ico = createIco([
    { png: png16, width: 16, height: 16 },
    { png: png32, width: 32, height: 32 },
  ]);
  writeFileSync(resolve(appDir, "favicon.ico"), ico);
  console.log("  favicon.ico (16+32)");

  // 7. OG Image - create programmatically since SVG text needs fonts
  await createOgImage(publicDir);
  console.log("  og-image.png (1200x630)");

  console.log("\nAll assets converted and placed!");
}

// Create ICO file from PNG buffers
function createIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  const numImages = images.length;
  let dataOffset = headerSize + entrySize * numImages;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(numImages, 4);

  const entries = [];
  const datas = [];

  for (const img of images) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.png.length, 8); // data size
    entry.writeUInt32LE(dataOffset, 12); // data offset

    entries.push(entry);
    datas.push(img.png);
    dataOffset += img.png.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

// Create OG image programmatically with sharp composites
async function createOgImage(outputDir) {
  const width = 1200;
  const height = 630;

  // Create dark background with subtle gradient
  const bg = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  // Create the lightning bolt icon (200x200 on dark surface)
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <rect width="200" height="200" rx="44" fill="#1E293B"/>
    <rect x="1" y="1" width="198" height="198" rx="43" fill="none" stroke="#334155" stroke-width="1.5" opacity="0.4"/>
    <defs>
      <linearGradient id="b" x1="100" y1="31" x2="100" y2="169" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#00E676"/>
        <stop offset="100%" stop-color="#00C853"/>
      </linearGradient>
    </defs>
    <polygon points="100,31 55,109 95,109 100,169 145,84 105,84" fill="url(#b)"/>
    <circle cx="100" cy="93" r="7" fill="#1E293B"/>
    <polygon points="96,99 100,112 104,99" fill="#1E293B"/>
  </svg>`;

  const iconBuf = await sharp(Buffer.from(iconSvg)).png().toBuffer();

  // Create text as SVG (rendered by sharp's librsvg)
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="280">
    <text x="0" y="80" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700" letter-spacing="-2">
      <tspan fill="#E2E8F0">Kirim</tspan><tspan fill="#00E676">Kode</tspan>
    </text>
    <text x="0" y="130" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#64748B" font-weight="400">
      Nomor Virtual OTP — Cepat, Aman, Terjangkau
    </text>
    <text x="0" y="185" font-family="Consolas, monospace" font-size="20" fill="#00E676" opacity="0.6">
      kirimkode.com
    </text>
  </svg>`;

  const textBuf = await sharp(Buffer.from(textSvg)).png().toBuffer();

  // Bottom accent bar (neon green line)
  const accentBar = await sharp({
    create: {
      width: 1200,
      height: 8,
      channels: 4,
      background: { r: 0, g: 230, b: 118, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  // Compose everything together
  await sharp(bg)
    .composite([
      { input: iconBuf, left: 200, top: 190 },
      { input: textBuf, left: 460, top: 195 },
      { input: accentBar, left: 0, top: 622 },
    ])
    .png({ quality: 90 })
    .toFile(resolve(outputDir, "og-image.png"));
}

convert().catch(console.error);
