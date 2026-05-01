import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { normalizeCountryName } from "@/data/country-mapping";

const SERVER_ID = "api4";

/**
 * Format kode di DB: "<realCode>#<shortId>" — misal "wa#k3jx9p"
 * Kode asli HeroSMS dipisah pakai "#" supaya 1 negara bisa punya
 * banyak entry untuk service code yang sama (beda harga).
 *
 * "wa" → cuma 1 entry → simpan apa adanya: "wa"
 * "wa#abc" → entry kedua dst → suffix unik
 */
export function buildVariantCode(realCode: string, shortId: string): string {
  return `${realCode}#${shortId}`;
}

export function extractRealCode(storedCode: string): string {
  const idx = storedCode.indexOf("#");
  return idx === -1 ? storedCode : storedCode.slice(0, idx);
}

function shortRand(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * GET — list semua manual entries untuk api4 (joined dengan country)
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const entries = await db.providerService.findMany({
      where: { serverId: SERVER_ID },
      include: {
        country: {
          select: { externalId: true, name: true },
        },
      },
      orderBy: [{ country: { name: "asc" } }, { name: "asc" }, { price: "asc" }],
    });

    const data = entries.map((e) => ({
      id: e.id,
      countryId: e.country.externalId,
      countryName: e.country.name,
      serviceCode: extractRealCode(e.code),  // tampilin kode asli ke admin
      storedCode: e.code,                    // composite (untuk debug)
      serviceName: e.name,
      price: e.price,
      stock: e.stock,
      maxPriceUsd: e.maxPriceUsd,
      fixedPrice: e.fixedPrice,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("api4-stock GET error:", err);
    return NextResponse.json({ error: "Gagal memuat data stock" }, { status: 500 });
  }
}

/**
 * POST — create new entry (no upsert by code).
 * Body wajib: { countryId, countryName, serviceCode, serviceName, price, stock, maxPriceUsd? }
 * Kalau body include `id` → update existing (edit mode).
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const {
      id,
      countryId,
      countryName,
      serviceCode,
      serviceName,
      price,
      stock,
      maxPriceUsd,
      fixedPrice,
    } = body;

    // fixedPrice opsional, default true
    const fixedPriceFinal = typeof fixedPrice === "boolean" ? fixedPrice : true;

    if (
      typeof countryId !== "number" ||
      !countryName ||
      !serviceCode ||
      !serviceName ||
      typeof price !== "number" ||
      typeof stock !== "number"
    ) {
      return NextResponse.json(
        { error: "Field wajib: countryId, countryName, serviceCode, serviceName, price, stock" },
        { status: 400 }
      );
    }

    if (price <= 0 || stock < 0) {
      return NextResponse.json(
        { error: "Harga harus > 0, stock harus ≥ 0" },
        { status: 400 }
      );
    }

    if (maxPriceUsd !== null && maxPriceUsd !== undefined && (typeof maxPriceUsd !== "number" || maxPriceUsd <= 0)) {
      return NextResponse.json(
        { error: "maxPriceUsd harus angka > 0 atau kosong" },
        { status: 400 }
      );
    }

    // Mode UPDATE (id disertakan)
    if (id) {
      const existing = await db.providerService.findUnique({
        where: { id },
        select: { id: true, serverId: true, code: true },
      });
      if (!existing || existing.serverId !== SERVER_ID) {
        return NextResponse.json({ error: "Entry tidak ditemukan" }, { status: 404 });
      }

      const updated = await db.providerService.update({
        where: { id },
        data: {
          name: serviceName,
          price,
          stock,
          maxPriceUsd: maxPriceUsd ?? null,
          fixedPrice: fixedPriceFinal,
        },
      });

      return NextResponse.json({ data: { id: updated.id, mode: "updated" } });
    }

    // Mode CREATE — upsert country dulu
    const country = await db.providerCountry.upsert({
      where: {
        serverId_externalId: { serverId: SERVER_ID, externalId: countryId },
      },
      update: {
        name: countryName,
        normalizedName: normalizeCountryName(countryName),
      },
      create: {
        serverId: SERVER_ID,
        externalId: countryId,
        name: countryName,
        normalizedName: normalizeCountryName(countryName),
      },
    });

    // Cari kode unik: kalau "wa" belum ada → pakai "wa". Kalau sudah → pakai "wa#xxxxxx"
    const cleanCode = serviceCode.split("#")[0]; // safety: kalau client kirim composite, strip dulu
    const existingPlain = await db.providerService.findUnique({
      where: {
        serverId_countryId_code: {
          serverId: SERVER_ID,
          countryId: country.id,
          code: cleanCode,
        },
      },
      select: { id: true },
    });

    let storedCode: string;
    if (!existingPlain) {
      // Belum ada → pakai kode bersih
      storedCode = cleanCode;
    } else {
      // Udah ada → loop generate suffix sampe unik
      let attempts = 0;
      while (true) {
        const candidate = buildVariantCode(cleanCode, shortRand());
        const conflict = await db.providerService.findUnique({
          where: {
            serverId_countryId_code: {
              serverId: SERVER_ID,
              countryId: country.id,
              code: candidate,
            },
          },
          select: { id: true },
        });
        if (!conflict) {
          storedCode = candidate;
          break;
        }
        if (++attempts > 5) {
          throw new Error("Gagal generate kode unik");
        }
      }
    }

    const created = await db.providerService.create({
      data: {
        serverId: SERVER_ID,
        countryId: country.id,
        code: storedCode,
        name: serviceName,
        price,
        stock,
        maxPriceUsd: maxPriceUsd ?? null,
        fixedPrice: fixedPriceFinal,
      },
    });

    return NextResponse.json({ data: { id: created.id, mode: "created", storedCode } });
  } catch (err) {
    console.error("api4-stock POST error:", err);
    return NextResponse.json({ error: "Gagal menyimpan entry" }, { status: 500 });
  }
}

/**
 * DELETE — hapus entry by id
 */
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID wajib" }, { status: 400 });
    }

    const entry = await db.providerService.findUnique({
      where: { id },
      select: { serverId: true, countryId: true },
    });

    if (!entry || entry.serverId !== SERVER_ID) {
      return NextResponse.json({ error: "Entry tidak ditemukan" }, { status: 404 });
    }

    await db.providerService.delete({ where: { id } });

    // Cleanup: kalau country gak punya service lagi, hapus juga
    const remaining = await db.providerService.count({
      where: { serverId: SERVER_ID, countryId: entry.countryId },
    });
    if (remaining === 0) {
      await db.providerCountry.delete({ where: { id: entry.countryId } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("api4-stock DELETE error:", err);
    return NextResponse.json({ error: "Gagal menghapus entry" }, { status: 500 });
  }
}
