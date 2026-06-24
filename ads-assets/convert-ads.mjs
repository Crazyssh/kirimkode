import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const jobs = [
  { svg: "ad-1-nokos-murah.svg", png: "ad-1-nokos-murah.png", w: 1080, h: 1080 },
  { svg: "ad-2-promo.svg", png: "ad-2-promo.png", w: 1080, h: 1080 },
  { svg: "ad-3-story.svg", png: "ad-3-story.png", w: 1080, h: 1920 },
];

for (const j of jobs) {
  await sharp(resolve(__dirname, j.svg))
    .resize(j.w, j.h)
    .png({ quality: 95 })
    .toFile(resolve(__dirname, j.png));
  console.log(`  ${j.png} (${j.w}x${j.h})`);
}
console.log("Done. PNG iklan ada di folder ads-assets/");
