/**
 * Seed master services + aliases.
 * Run: npx tsx prisma/seed-services.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../src/generated/prisma");

const db = new PrismaClient();

interface MasterServiceDef {
  id: string;
  name: string;
  category: string;
  aliases: string[]; // all provider codes that map to this service
}

const SERVICES: MasterServiceDef[] = [
  // === Messenger ===
  { id: "wa", name: "WhatsApp", category: "Messenger", aliases: ["wa", "whatsapp"] },
  { id: "tg", name: "Telegram", category: "Messenger", aliases: ["tg", "telegram"] },
  { id: "ds", name: "Discord", category: "Messenger", aliases: ["ds", "discord"] },
  { id: "vi", name: "Viber", category: "Messenger", aliases: ["vi", "viber"] },
  { id: "im", name: "IMO", category: "Messenger", aliases: ["im", "imo"] },
  { id: "me", name: "LINE", category: "Messenger", aliases: ["me", "line"] },
  { id: "bw", name: "Signal", category: "Messenger", aliases: ["bw", "signal"] },
  { id: "wb", name: "WeChat", category: "Messenger", aliases: ["wb", "wechat"] },

  // === Social Media ===
  { id: "ig", name: "Instagram", category: "Social", aliases: ["ig", "instagram"] },
  { id: "fb", name: "Facebook", category: "Social", aliases: ["fb", "facebook"] },
  { id: "tw", name: "Twitter/X", category: "Social", aliases: ["tw", "twitter"] },
  { id: "lf", name: "TikTok", category: "Social", aliases: ["lf", "tiktok"] },
  { id: "fu", name: "Snapchat", category: "Social", aliases: ["fu", "snapchat"] },
  { id: "tn", name: "LinkedIn", category: "Social", aliases: ["tn", "linkedin"] },
  { id: "hb", name: "Twitch", category: "Social", aliases: ["hb", "twitch"] },
  { id: "bl", name: "BIGO LIVE", category: "Social", aliases: ["bl", "bigolive"] },
  { id: "oi", name: "Tinder", category: "Social", aliases: ["oi", "tinder"] },
  { id: "mo", name: "Bumble", category: "Social", aliases: ["mo", "bumble"] },
  { id: "df", name: "Happn", category: "Social", aliases: ["df", "happn"] },
  { id: "vz", name: "Hinge", category: "Social", aliases: ["vz", "hinge"] },

  // === Tech / Email ===
  { id: "go", name: "Google", category: "Tech", aliases: ["go", "google"] },
  { id: "mm", name: "Microsoft", category: "Tech", aliases: ["mm", "microsoft"] },
  { id: "wx", name: "Apple", category: "Tech", aliases: ["wx", "apple"] },
  { id: "mb", name: "Yahoo", category: "Tech", aliases: ["mb", "yahoo"] },
  { id: "pm", name: "AOL", category: "Tech", aliases: ["pm", "aol"] },
  { id: "dp", name: "ProtonMail", category: "Tech", aliases: ["dp", "protonmail", "proton"] },
  { id: "dr", name: "OpenAI", category: "Tech", aliases: ["dr", "openai"] },
  { id: "mt", name: "Steam", category: "Tech", aliases: ["mt", "steam"] },

  // === E-Commerce ===
  { id: "am", name: "Amazon", category: "Shopping", aliases: ["am", "amazon"] },
  { id: "ka", name: "Shopee", category: "Shopping", aliases: ["ka", "shopee"] },
  { id: "dl", name: "Lazada", category: "Shopping", aliases: ["dl", "lazada"] },
  { id: "xd", name: "Tokopedia", category: "Shopping", aliases: ["xd", "tokopedia"] },
  { id: "fk", name: "Blibli", category: "Shopping", aliases: ["fk", "blibli"] },
  { id: "xt", name: "Flipkart", category: "Shopping", aliases: ["xt", "flipkart"] },
  { id: "dh", name: "eBay", category: "Shopping", aliases: ["dh", "ebay"] },

  // === Ride & Food ===
  { id: "ub", name: "Uber", category: "Transport", aliases: ["ub", "uber"] },
  { id: "jg", name: "Grab", category: "Transport", aliases: ["jg", "grabtaxi", "grab"] },
  { id: "ni", name: "Gojek", category: "Transport", aliases: ["ni", "gojek"] },
  { id: "nz", name: "Foodpanda", category: "Food", aliases: ["nz", "foodpanda"] },
  { id: "jx", name: "Swiggy", category: "Food", aliases: ["jx", "swiggy"] },

  // === Finance ===
  { id: "ts", name: "PayPal", category: "Finance", aliases: ["ts", "paypal"] },
  { id: "fr", name: "Dana", category: "Finance", aliases: ["fr", "dana"] },
  { id: "xh", name: "OVO", category: "Finance", aliases: ["xh", "ovo"] },
  { id: "re", name: "Coinbase", category: "Finance", aliases: ["re", "coinbase"] },
  { id: "ij", name: "Revolut", category: "Finance", aliases: ["ij", "revolut"] },

  // === Entertainment ===
  { id: "nf", name: "Netflix", category: "Entertainment", aliases: ["nf", "netflix"] },
  { id: "alj", name: "Spotify", category: "Entertainment", aliases: ["alj", "spotify"] },

  // === Other popular ===
  { id: "uk", name: "Airbnb", category: "Other", aliases: ["uk", "airbnb"] },
  { id: "ew", name: "Nike", category: "Other", aliases: ["ew", "nike"] },
  { id: "ot", name: "Any Other", category: "Other", aliases: ["ot", "other"] },
  { id: "ep", name: "Temu", category: "Shopping", aliases: ["ep", "temu"] },
  { id: "cn", name: "Fiverr", category: "Other", aliases: ["cn", "fiverr"] },

  // Indonesian specifics
  { id: "ju", name: "Indomaret", category: "Shopping", aliases: ["ju", "indomaret"] },
  { id: "bn", name: "Alfagift", category: "Shopping", aliases: ["bn", "alfagift"] },
  { id: "aka", name: "LinkAja", category: "Finance", aliases: ["aka", "linkaja"] },
  { id: "gf", name: "Google Voice", category: "Tech", aliases: ["gf", "googlevoice"] },

  // Gambling / Gaming
  { id: "ie", name: "Bet365", category: "Gaming", aliases: ["ie", "bet365"] },
  { id: "sn", name: "OLX", category: "Other", aliases: ["sn", "olx"] },
];

async function main() {
  console.log("🌱 Seeding master services...");

  let created = 0;
  let aliasCount = 0;

  for (const svc of SERVICES) {
    // Upsert master service
    await db.masterService.upsert({
      where: { id: svc.id },
      update: { name: svc.name, category: svc.category },
      create: { id: svc.id, name: svc.name, category: svc.category, icon: "" },
    });
    created++;

    // Upsert aliases
    for (const alias of svc.aliases) {
      await db.serviceAlias.upsert({
        where: {
          masterServiceId_providerCode: {
            masterServiceId: svc.id,
            providerCode: alias,
          },
        },
        update: {},
        create: {
          masterServiceId: svc.id,
          providerCode: alias,
        },
      });
      aliasCount++;
    }
  }

  // Auto-link existing ProviderService records to master services
  console.log("🔗 Linking existing provider services to master...");

  const aliases = await db.serviceAlias.findMany();
  const codeToMaster = new Map<string, string>();
  for (const a of aliases) {
    codeToMaster.set(a.providerCode, a.masterServiceId);
  }

  let linked = 0;
  for (const [code, masterId] of codeToMaster) {
    const result = await db.providerService.updateMany({
      where: { code, masterServiceId: null },
      data: { masterServiceId: masterId },
    });
    linked += result.count;
  }

  console.log(`✅ Done: ${created} master services, ${aliasCount} aliases, ${linked} provider services linked`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
