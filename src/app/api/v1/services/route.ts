import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getLayanan } from "@/lib/otp";
import { applyPricing } from "@/lib/pricing";

type PublicServer = "api1" | "api2" | "api3" | "api4" | "api5" | "api6" | "api7";
const VALID_SERVERS: readonly PublicServer[] = ["api1", "api2", "api3", "api4", "api5", "api6", "api7"];
const FINAL_PRICE_SERVERS = new Set<PublicServer>(["api3", "api4", "api6"]);

export const GET = withApiAuth(async (req) => {
  const server = (req.nextUrl.searchParams.get("server") || "api1") as PublicServer;
  const negara = Number(req.nextUrl.searchParams.get("country") || "6");

  if (!VALID_SERVERS.includes(server)) {
    return apiError(
      "Invalid server (api1, api2, api3, api4, api5, api6, or api7)",
      400,
      "INVALID_SERVER"
    );
  }

  try {
    const data = await getLayanan(server, negara);
    const negaraKey = String(negara);
    const layananData = data?.[negaraKey] || data?.data?.[negaraKey] || {};

    const isFinal = FINAL_PRICE_SERVERS.has(server);

    const services = await Promise.all(
      Object.entries(layananData)
        .filter(
          ([, info]) =>
            info && typeof info === "object" && "layanan" in (info as Record<string, unknown>)
        )
        .map(async ([code, info]) => {
          const item = info as { layanan: string; harga: number; stok: number };
          // api1/api2/api5: harga raw → apply pricing rules
          // api3/api4: harga sudah final di adapter
          const finalPrice = isFinal
            ? item.harga
            : (await applyPricing(item.harga, code, negara)).price;
          return {
            code,
            name: item.layanan,
            price: finalPrice,
            stock: item.stok,
          };
        })
    );

    return apiSuccess(services);
  } catch {
    return apiError("Failed to fetch services", 500, "FETCH_FAILED");
  }
});
