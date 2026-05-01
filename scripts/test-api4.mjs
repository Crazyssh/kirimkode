// Test ad-hoc: panggil HeroSMS pake PROVIDER4_API_KEY untuk WhatsApp Indonesia.
// Run: node scripts/test-api4.mjs
import "dotenv/config";

const API_KEY = process.env.PROVIDER4_API_KEY;
const BASE = process.env.PROVIDER4_API_URL || process.env.PROVIDER3_API_URL || "https://hero-sms.com/stubs/handler_api.php";

if (!API_KEY) {
  console.error("PROVIDER4_API_KEY tidak ada di .env");
  process.exit(1);
}

const COUNTRY_ID = 6;       // Indonesia
const SERVICE_CODE = "wa";  // WhatsApp
const MARKUP = 1.15;

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
  console.log("=== Test PROVIDER4 (HeroSMS V2) ===\n");

  // 1. Balance
  console.log("[1] Cek saldo HeroSMS...");
  const balText = await call("getBalance");
  console.log("    Response:", balText);

  // 2. Kurs USD/IDR
  console.log("\n[2] Fetch kurs USD/IDR...");
  const kurs = await getKurs();
  console.log("    1 USD =", kurs.toLocaleString("id-ID"), "IDR");

  // 3. Price list Indonesia
  console.log("\n[3] Fetch price list Indonesia (country=6)...");
  const pricesText = await call("getPrices", { country: COUNTRY_ID });
  let prices;
  try {
    prices = JSON.parse(pricesText);
  } catch {
    console.error("    Gagal parse JSON:", pricesText.slice(0, 200));
    return;
  }

  // 4. Cari WhatsApp
  const countryData = prices?.[COUNTRY_ID] || prices;
  const wa = countryData?.[SERVICE_CODE];
  if (!wa) {
    console.error(`    Layanan '${SERVICE_CODE}' tidak ditemukan di country ${COUNTRY_ID}`);
    console.log("    Available services (5 pertama):", Object.keys(countryData).slice(0, 5));
    return;
  }

  console.log("    Raw HeroSMS:", wa);
  const usdCost = wa.cost;
  const stock = wa.count || 0;

  // 5. Hitung harga IDR
  const idrFinal = Math.ceil(usdCost * kurs * MARKUP);
  const idrModal = Math.ceil(usdCost * kurs);
  const profit = idrFinal - idrModal;

  console.log("\n[4] Hitungan harga jual:");
  console.log(`    USD cost          : $${usdCost}`);
  console.log(`    Stock             : ${stock} nomor`);
  console.log(`    Modal IDR (×kurs) : Rp ${idrModal.toLocaleString("id-ID")}`);
  console.log(`    Markup ×${MARKUP}      : Rp ${idrFinal.toLocaleString("id-ID")}  ← user bayar segini`);
  console.log(`    Untung gross      : Rp ${profit.toLocaleString("id-ID")} (${(((profit / idrModal) * 100).toFixed(1))}% di atas modal)`);

  // 6. Estimasi maxPrice yang akan dipake
  console.log(`\n[5] maxPrice yang akan dipake pas getNumberV2: ${usdCost.toFixed(4)}`);

  console.log("\n=== Selesai (gak buat order, cuma price check) ===");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
