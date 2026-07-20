// Ambil SEMUA harga layanan Indonesia (country=6) dari HeroSMS.
// Urut dari termahal → biar kelihatan layanan mana yang worth buat supply sendiri.
// Run: node scripts/herosms-id-prices.mjs
import "dotenv/config";

const API_KEY = process.env.PROVIDER4_API_KEY || process.env.PROVIDER3_API_KEY;
const BASE =
  process.env.PROVIDER4_API_URL ||
  process.env.PROVIDER3_API_URL ||
  "https://hero-sms.com/stubs/handler_api.php";

if (!API_KEY) {
  console.error("PROVIDER4_API_KEY / PROVIDER3_API_KEY tidak ada di .env");
  process.exit(1);
}

const COUNTRY_ID = 6; // Indonesia

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

async function getServiceNames() {
  try {
    const text = await call("getServicesList");
    const data = JSON.parse(text);
    const names = {};
    const services = data?.services;
    if (Array.isArray(services)) {
      for (const s of services) if (s.code && s.name) names[s.code] = s.name;
    } else if (data && typeof data === "object") {
      for (const [code, info] of Object.entries(data)) {
        if (typeof info === "string") names[code] = info;
        else if (info && typeof info === "object" && info.name) names[code] = info.name;
      }
    }
    return names;
  } catch {
    return {};
  }
}

async function main() {
  const kurs = await getKurs();
  console.log(`Kurs: 1 USD = Rp ${kurs.toLocaleString("id-ID")}\n`);

  const [pricesText, names] = await Promise.all([
    call("getPrices", { country: COUNTRY_ID }),
    getServiceNames(),
  ]);

  let prices;
  try {
    prices = JSON.parse(pricesText);
  } catch {
    console.error("Gagal parse JSON:", pricesText.slice(0, 300));
    return;
  }

  const countryData = prices?.[COUNTRY_ID] || prices;
  const rows = [];
  for (const [code, info] of Object.entries(countryData)) {
    if (info && typeof info === "object" && typeof info.cost === "number") {
      rows.push({
        code,
        name: names[code] || code,
        usd: info.cost,
        stock: info.count || 0,
        idr: Math.ceil(info.cost * kurs),
      });
    }
  }

  rows.sort((a, b) => b.usd - a.usd); // termahal dulu

  console.log(`Total layanan Indonesia: ${rows.length}\n`);
  console.log("HARGA MODAL (harga beli di HeroSMS, belum markup):\n");
  console.log("No   Kode          Layanan                    USD        Rp (modal)   Stok");
  console.log("-".repeat(90));
  rows.forEach((r, i) => {
    console.log(
      String(i + 1).padEnd(5) +
        r.code.padEnd(14) +
        String(r.name).slice(0, 26).padEnd(27) +
        ("$" + r.usd.toFixed(4)).padEnd(11) +
        ("Rp " + r.idr.toLocaleString("id-ID")).padEnd(13) +
        r.stock
    );
  });

  // Ringkas: berapa yang > Rp5.000 (target "layanan mahal")
  const mahal = rows.filter((r) => r.idr >= 5000);
  console.log(`\nLayanan modal >= Rp5.000: ${mahal.length} dari ${rows.length}`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
