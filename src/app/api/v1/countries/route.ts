import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getNegara } from "@/lib/otp";

type PublicServer = "api1" | "api2" | "api3" | "api4" | "api5" | "api6";
const VALID_SERVERS: readonly PublicServer[] = ["api1", "api2", "api3", "api4", "api5", "api6"];

interface CountryRow {
  id: number;
  name: string;
}

/**
 * GET /v1/countries?server=api1
 *
 * Daftar negara yang available di provider tersebut.
 * Gunakan `id` di field `country` saat POST /order.
 *
 * Source:
 *  - api1/api2/api3/api5: dari DB (di-sync cron). Fallback ke API kalau DB kosong.
 *  - api4: dari DB (manual entry admin). Cuma negara yang punya minimal 1 layanan.
 */
export const GET = withApiAuth(async (req) => {
  const server = req.nextUrl.searchParams.get("server") as PublicServer | null;

  if (!server || !VALID_SERVERS.includes(server)) {
    return apiError(
      "Invalid server (api1, api2, api3, api4, api5, or api6)",
      400,
      "INVALID_SERVER"
    );
  }

  try {
    // api4: hanya negara yg ada layanan-nya (manual stock)
    if (server === "api4") {
      const countries = await db.providerCountry.findMany({
        where: {
          serverId: "api4",
          services: { some: { serverId: "api4" } },
        },
        select: { externalId: true, name: true },
        orderBy: { name: "asc" },
      });

      const data: CountryRow[] = countries.map((c) => ({
        id: c.externalId,
        name: c.name,
      }));
      return apiSuccess(data);
    }

    // api1/api2/api3/api5: pakai DB (cached via cron sync), fallback ke API
    const countries = await db.providerCountry.findMany({
      where: { serverId: server },
      select: { externalId: true, name: true },
      orderBy: { name: "asc" },
    });

    if (countries.length > 0) {
      const data: CountryRow[] = countries.map((c) => ({
        id: c.externalId,
        name: c.name,
      }));
      return apiSuccess(data);
    }

    // Fallback: fetch langsung dari provider (DB belum di-sync)
    const raw = await getNegara(server);
    const list = normalizeNegaraResponse(raw);
    return apiSuccess(list);
  } catch {
    return apiError("Failed to fetch countries", 500, "FETCH_FAILED");
  }
});

/**
 * Normalisasi response getNegara dari berbagai provider ke shape standar.
 * - JasaOTP api1/api2: { "6": "Indonesia", "0": "Russia", ... } atau { data: {...} }
 * - provider3/provider4: { success, data: [{ id_negara, nama_negara }] }
 */
function normalizeNegaraResponse(raw: unknown): CountryRow[] {
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;

  // Format provider3/provider4: { data: [{ id_negara, nama_negara }] }
  if (Array.isArray(obj.data)) {
    return (obj.data as Array<{ id_negara?: number; nama_negara?: string }>)
      .filter((c) => typeof c.id_negara === "number" && typeof c.nama_negara === "string")
      .map((c) => ({ id: c.id_negara as number, name: c.nama_negara as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Format JasaOTP nested: { data: { "6": "Indonesia", ... } }
  const flat = (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;

  return Object.entries(flat)
    .filter(([key, val]) => /^\d+$/.test(key) && typeof val === "string")
    .map(([key, val]) => ({ id: Number(key), name: val as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
