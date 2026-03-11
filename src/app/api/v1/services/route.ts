import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getLayanan } from "@/lib/otp";

export const GET = withApiAuth(async (req) => {
  const server = (req.nextUrl.searchParams.get("server") || "api1") as "api1" | "api2";
  const negara = Number(req.nextUrl.searchParams.get("country") || "6");

  if (!["api1", "api2"].includes(server)) {
    return apiError("Invalid server (api1 or api2)", 400, "INVALID_SERVER");
  }

  try {
    const data = await getLayanan(server, negara);
    const negaraKey = String(negara);
    const layananData = data?.[negaraKey] || data?.data?.[negaraKey] || {};

    const services = Object.entries(layananData)
      .filter(([, info]) => info && typeof info === "object" && "layanan" in (info as Record<string, unknown>))
      .map(([code, info]) => {
        const item = info as { layanan: string; harga: number; stok: number };
        return {
          code,
          name: item.layanan,
          price: item.harga,
          stock: item.stok,
        };
      });

    return apiSuccess(services);
  } catch {
    return apiError("Failed to fetch services", 500, "FETCH_FAILED");
  }
});
