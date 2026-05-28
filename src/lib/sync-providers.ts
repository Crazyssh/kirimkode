/**
 * Sync semua provider (api1/api2/api3/api5/api6) data ke database lokal.
 * Dipanggil oleh cron endpoint setiap 1 jam.
 *
 * NOTE: api4 (HeroSMS V2) sengaja TIDAK di-sync — semua data negara/layanan
 * diambil langsung realtime dari API key (pake cache adapter internal).
 */

import { db } from "@/lib/db";
import { getNegara, getLayanan, getOperator } from "@/lib/otp";
import type { ServerId } from "@/lib/otp";
import { normalizeCountryName } from "@/data/country-mapping";

type SyncableServerId = "api1" | "api2" | "api3" | "api5" | "api6" | "api7" | "api8" | "api9" | "api10";

interface SyncResult {
  server: string;
  countries: number;
  services: number;
  operators: number;
  errors: string[];
  durationMs: number;
}

/**
 * Batch helper — proses array in chunks of `size`, with optional delay antar batch
 */
async function batchProcess<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
  delayMs = 200
): Promise<string[]> {
  const errors: string[] = [];

  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.allSettled(batch.map(fn));

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason));
      }
    }

    // Delay antar batch supaya gak overload provider
    if (i + size < items.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return errors;
}

/**
 * Sync satu server ke database (api1, api2, atau api3)
 */
export async function syncProvider(serverId: SyncableServerId): Promise<SyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  let countryCount = 0;
  let serviceCount = 0;
  let operatorCount = 0;

  try {
    // Step 1: Fetch semua negara
    const negaraRes = await getNegara(serverId as ServerId);
    const negaraList: Array<{ id_negara: number; nama_negara: string }> =
      negaraRes?.data || negaraRes?.success && negaraRes?.data || [];

    if (!negaraList || negaraList.length === 0) {
      throw new Error(`Tidak ada data negara dari ${serverId}`);
    }

    // Step 2: Upsert semua negara ke DB
    const countryIds = new Map<number, string>(); // externalId → db id

    for (const negara of negaraList) {
      const normalized = normalizeCountryName(negara.nama_negara);
      const country = await db.providerCountry.upsert({
        where: {
          serverId_externalId: {
            serverId,
            externalId: negara.id_negara,
          },
        },
        update: {
          name: negara.nama_negara,
          normalizedName: normalized,
        },
        create: {
          serverId,
          externalId: negara.id_negara,
          name: negara.nama_negara,
          normalizedName: normalized,
        },
      });
      countryIds.set(negara.id_negara, country.id);
    }

    countryCount = countryIds.size;

    // Step 3: Per negara — fetch layanan + operator (batch paralel).
    // api6 (5sim) lebih lambat & punya rate limit ketat → concurrency lebih rendah.
    const concurrency = serverId === "api6" ? 3 : 5;
    const batchDelay = serverId === "api6" ? 300 : 200;

    const syncErrors = await batchProcess(
      negaraList,
      concurrency,
      async (negara) => {
        const dbCountryId = countryIds.get(negara.id_negara);
        if (!dbCountryId) return;

        // Fetch layanan
        try {
          const layananData = await getLayanan(serverId as ServerId, negara.id_negara);
          const negaraKey = String(negara.id_negara);

          let serviceData: Record<string, { harga: number; stok: number; layanan: string }> | null = null;

          if (layananData?.[negaraKey] && typeof layananData[negaraKey] === "object") {
            serviceData = layananData[negaraKey];
          } else if (layananData?.data?.[negaraKey]) {
            serviceData = layananData.data[negaraKey];
          }

          if (serviceData) {
            // Track active codes untuk cleanup di akhir
            const activeCodes: string[] = [];

            for (const [code, info] of Object.entries(serviceData)) {
              if (info && typeof info === "object" && "harga" in info) {
                activeCodes.push(code);
                await db.providerService.upsert({
                  where: {
                    serverId_countryId_code: {
                      serverId,
                      countryId: dbCountryId,
                      code,
                    },
                  },
                  update: {
                    name: info.layanan || code,
                    price: info.harga,
                    stock: info.stok || 0,
                  },
                  create: {
                    serverId,
                    countryId: dbCountryId,
                    code,
                    name: info.layanan || code,
                    price: info.harga,
                    stock: info.stok || 0,
                  },
                });
                serviceCount++;
              }
            }

            // Cleanup service lama yang sudah tidak ada di provider
            // Penting untuk Venus (api6) — code berubah dari "whatsapp" → "whatsapp#virtual53"
            if (activeCodes.length > 0) {
              await db.providerService.deleteMany({
                where: {
                  serverId,
                  countryId: dbCountryId,
                  code: { notIn: activeCodes },
                },
              });
            }
          }
        } catch (err) {
          errors.push(`[${serverId}] Layanan ${negara.nama_negara}: ${(err as Error).message}`);
        }

        // Fetch operator (api1 & api7 support operator selection, lainnya skip)
        if (serverId === "api1" || serverId === "api7") {
          try {
            const opData = await getOperator(serverId as ServerId, negara.id_negara);
            const negaraKey = String(negara.id_negara);
            const ops: string[] = opData?.data?.[negaraKey] || ["any"];

            for (const op of ops) {
              await db.providerOperator.upsert({
                where: {
                  serverId_countryId_operator: {
                    serverId,
                    countryId: dbCountryId,
                    operator: op,
                  },
                },
                update: {},
                create: {
                  serverId,
                  countryId: dbCountryId,
                  operator: op,
                },
              });
              operatorCount++;
            }
          } catch (err) {
            errors.push(`[${serverId}] Operator ${negara.nama_negara}: ${(err as Error).message}`);
          }
        }
      },
      batchDelay
    );

    errors.push(...syncErrors);

    // Step 4: Cleanup — hapus negara yang sudah tidak ada di API
    const activeExternalIds = negaraList.map((n) => n.id_negara);
    await db.providerCountry.deleteMany({
      where: {
        serverId,
        externalId: { notIn: activeExternalIds },
      },
    });

  } catch (err) {
    errors.push(`[${serverId}] Fatal: ${(err as Error).message}`);
  }

  return {
    server: serverId,
    countries: countryCount,
    services: serviceCount,
    operators: operatorCount,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Sync semua provider (api1 + api2 + api3 + api5 + api6 + api7) — sequential supaya gak overload.
 * api4 di-skip — diambil realtime dari API.
 */
export async function syncAllProviders(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const server of ["api1", "api2", "api3", "api5", "api6", "api7", "api8", "api9", "api10"] as SyncableServerId[]) {
    console.log(`[Sync] Starting sync for ${server}...`);
    const result = await syncProvider(server);
    console.log(
      `[Sync] ${server} done: ${result.countries} countries, ${result.services} services, ${result.operators} operators in ${result.durationMs}ms`
    );
    if (result.errors.length > 0) {
      console.warn(`[Sync] ${server} errors:`, result.errors.slice(0, 5));
    }
    results.push(result);
  }

  return results;
}

/** @deprecated Use syncAllProviders instead */
export const syncAllJasaOTP = syncAllProviders;
