// List semua varian WhatsApp untuk Indonesia di HeroSMS via PROVIDER4_API_KEY
// Run: node scripts/test-api4-wa.mjs
import "dotenv/config";

const API_KEY = process.env.PROVIDER4_API_KEY;
const BASE = process.env.PROVIDER4_API_URL || process.env.PROVIDER3_API_URL || "https://hero-sms.com/stubs/handler_api.php";

if (!API_KEY) {
  console.error("PROVIDER4_API_KEY tidak ada di .env");
  process.exit(1);
}

const COUNTRY_ID = 6;
const MARKUP_API4 = 1.15;
const MARKUP_API3 = 1.35;

function call(action, extra = {}) {
  const url = new URL(BASE);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, String(v));
  return fetch(url, { cache: "no-store" }).then((r) => r.text());
}

async function getKurs() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    const data = await res.json();
    return data?.rates?.IDR || 16500;
  } catch {
    return 16500;
  }
}

async function main() {
  console.log("=== Semua varian WhatsApp di Indonesia (HeroSMS) ===\n");

  const [pricesText, servicesText, kurs] = await Promise.all([
    call("getPrices", { country: COUNTRY_ID }),
    call("getServicesList"),
    getKurs(),
  ]);

  let prices, services;
  try {
    prices = JSON.parse(pricesText);
  } catch {
    console.error("Gagal parse getPrices:", pricesText.slice(0, 200));
    return;
  }
  try {
    services = JSON.parse(servicesText);
  } catch {
    services = {};
  }

  // Build mapping code → nama dari services list
  const serviceNames = {};
  if (Array.isArray(services?.services)) {
    for (const s of services.services) {
      if (s.code && s.name) serviceNames[s.code] = s.name;
    }
  } else if (services && typeof services === "object") {
    for (const [code, info] of Object.entries(services)) {
      if (typeof info === "string") serviceNames[code] = info;
      else if (info?.name) serviceNames[code] = info.name;
    }
  }

  const countryData = prices?.[COUNTRY_ID] || prices;
  if (!countryData || typeof countryData !== "object") {
    console.error("Gak ada data harga untuk Indonesia");
    return;
  }

  // Filter semua service yang berhubungan dgn WhatsApp
  const waMatches = [];
  for (const [code, info] of Object.entries(countryData)) {
    if (!info || typeof info !== "object") continue;
    const name = serviceNames[code] || code;
    const isWa =
      /wa|whats/i.test(code) ||
      /whatsapp|whats\s*app/i.test(name);
    if (isWa) {
      waMatches.push({
        code,
        name,
        cost: info.cost,
        stock: info.count || 0,
      });
    }
  }

  if (waMatches.length === 0) {
    console.log("Gak ada varian WhatsApp di country=6");
    console.log("\nDebug — 10 service pertama:");
    Object.entries(countryData).slice(0, 10).forEach(([k, v]) => {
      console.log(`  ${k} (${serviceNames[k] || "?"}): $${v.cost}, stok ${v.count}`);
    });
    return;
  }

  // Sort by cost
  waMatches.sort((a, b) => a.cost - b.cost);

  console.log(`Kurs realtime: 1 USD = Rp ${kurs.toLocaleString("id-ID")}\n`);
  console.log(
    "code".padEnd(15),
    "name".padEnd(28),
    "cost USD".padStart(10),
    "stok".padStart(8),
    "Neptune (1.15)".padStart(16),
    "Saturn (1.35)".padStart(16),
    "selisih".padStart(10),
  );
  console.log("─".repeat(110));

  for (const wa of waMatches) {
    const idr115 = Math.ceil(wa.cost * kurs * MARKUP_API4);
    const idr135 = Math.ceil(wa.cost * kurs * MARKUP_API3);
    const diff = idr135 - idr115;
    console.log(
      wa.code.padEnd(15),
      wa.name.padEnd(28),
      `$${wa.cost.toFixed(4)}`.padStart(10),
      String(wa.stock).padStart(8),
      `Rp ${idr115.toLocaleString("id-ID")}`.padStart(16),
      `Rp ${idr135.toLocaleString("id-ID")}`.padStart(16),
      `Rp ${diff.toLocaleString("id-ID")}`.padStart(10),
    );
  }

  console.log("\nTotal varian WhatsApp ditemukan:", waMatches.length);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
