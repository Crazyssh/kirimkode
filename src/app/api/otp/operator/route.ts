import { NextRequest, NextResponse } from "next/server";
import { getOperator } from "@/lib/otp";
import { db } from "@/lib/db";
import { getUnifiedOperator } from "@/lib/unified-provider";

export async function GET(req: NextRequest) {
  const server = req.nextUrl.searchParams.get("server") as "api1" | "api2" | "api3" | "api4" | "unified";
  const negara = req.nextUrl.searchParams.get("negara");

  if (!server || !["api1", "api2", "api3", "api4", "unified"].includes(server)) {
    return NextResponse.json({ error: "Server parameter required" }, { status: 400 });
  }

  if (!negara) {
    return NextResponse.json({ error: "Parameter negara diperlukan" }, { status: 400 });
  }

  try {
    const negaraId = Number(negara);

    // unified: return operators (delegation to unified-provider)
    if (server === "unified") {
      const data = await getUnifiedOperator(negaraId);
      return NextResponse.json(data);
    }

    // api1/api2/api3: baca dari database
    if (server === "api1" || server === "api2" || server === "api3") {
      const country = await db.providerCountry.findUnique({
        where: {
          serverId_externalId: {
            serverId: server,
            externalId: negaraId,
          },
        },
        select: { id: true },
      });

      if (country) {
        const operators = await db.providerOperator.findMany({
          where: {
            serverId: server,
            countryId: country.id,
          },
          select: { operator: true },
        });

        const negaraKey = String(negaraId);
        const ops = operators.length > 0
          ? operators.map((o) => o.operator)
          : ["any"];

        return NextResponse.json({ data: { [negaraKey]: ops } });
      }

      // Fallback: kalau belum ada di DB
    }

    // api3/api4 atau fallback: fetch langsung
    const data = await getOperator(server, negaraId);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil daftar operator" }, { status: 500 });
  }
}
