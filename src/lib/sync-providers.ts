/**
 * Sync JasaOTP (api1/api2) data ke database lokal.
 * Dipanggil oleh cron endpoint setiap 1 jam.
 */

import { db } from "@/lib/db";
import { getNegara, getLayanan, getOperator } from "@/lib/otp";
import type { ServerId } from "@/lib/otp";

type JasaOtpServerId = "api1" | "api2";

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
 * Sync satu server JasaOTP ke database
 */
export async function syncJasaOTP(serverId: JasaOtpServerId): Promise<SyncResult> {
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
      const country = await db.providerCountry.upsert({
        where: {
          serverId_externalId: {
            serverId,
            externalId: negara.id_negara,
          },
        },
        update: {
          name: negara.nama_negara,
        },
        create: {
          serverId,
          externalId: negara.id_negara,
          name: negara.nama_negara,
        },
      });
      countryIds.set(negara.id_negara, country.id);
    }

    countryCount = countryIds.size;

    // Step 3: Per negara — fetch layanan + operator (batch 5 paralel)
    const syncErrors = await batchProcess(
      negaraList,
      5,
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
            for (const [code, info] of Object.entries(serviceData)) {
              if (info && typeof info === "object" && "harga" in info) {
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
          }
        } catch (err) {
          errors.push(`[${serverId}] Layanan ${negara.nama_negara}: ${(err as Error).message}`);
        }

        // Fetch operator (hanya api1 yang support operator selection)
        if (serverId === "api1") {
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
      200
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
 * Sync semua server JasaOTP (api1 + api2)
 */
export async function syncAllJasaOTP(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Sync api1 dulu, lalu api2 (sequential supaya gak overload)
  for (const server of ["api1", "api2"] as JasaOtpServerId[]) {
    console.log(`[Sync] Starting sync for ${server}...`);
    const result = await syncJasaOTP(server);
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
