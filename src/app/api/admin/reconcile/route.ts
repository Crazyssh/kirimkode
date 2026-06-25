import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/**
 * Rekonsiliasi saldo user: bandingkan saldo aktual vs saldo seharusnya
 * (deposit paid + bonus voucher − belanja[success+waiting]).
 *
 *   selisih = saldo_aktual − saldo_seharusnya
 *     < 0  → saldo user KURANG (hilang, refund gagal)
 *     > 0  → saldo user LEBIH (kelebihan refund / bonus tak tercatat)
 *     = 0  → pas
 *
 * Query param:
 *   filter = "minus" | "plus" | "all" (default "minus")
 *   limit  = max baris (default 100, max 500)
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const filter = req.nextUrl.searchParams.get("filter") || "minus";
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 100));

  // Kondisi selisih sesuai filter
  let having = "u.balance <> seharusnya";
  if (filter === "minus") having = "u.balance < seharusnya";
  else if (filter === "plus") having = "u.balance > seharusnya";

  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string;
      email: string;
      name: string | null;
      balance: number;
      deposit: number;
      bonus: number;
      belanja: number;
      seharusnya: number;
      selisih: number;
    }>>(
      `
      SELECT u.id, u.email, u.name, u.balance,
             COALESCE(d.dep,0)::int AS deposit,
             COALESCE(b.bon,0)::int AS bonus,
             COALESCE(o.spent,0)::int AS belanja,
             (COALESCE(d.dep,0) + COALESCE(b.bon,0) - COALESCE(o.spent,0))::int AS seharusnya,
             (u.balance - (COALESCE(d.dep,0) + COALESCE(b.bon,0) - COALESCE(o.spent,0)))::int AS selisih
      FROM users u
      LEFT JOIN (SELECT "userId", SUM(amount) dep FROM deposits WHERE status='paid' GROUP BY "userId") d ON d."userId"=u.id
      LEFT JOIN (SELECT "userId", SUM(bonus) bon FROM voucher_usages GROUP BY "userId") b ON b."userId"=u.id
      LEFT JOIN (SELECT "userId", SUM(price) spent FROM orders WHERE status IN ('success','waiting') GROUP BY "userId") o ON o."userId"=u.id
      WHERE ${having.replace(/seharusnya/g, "(COALESCE(d.dep,0) + COALESCE(b.bon,0) - COALESCE(o.spent,0))")}
      ORDER BY selisih ASC
      LIMIT ${limit}
      `
    );

    // Ringkasan total
    const totalMinus = rows.filter((r) => r.selisih < 0).reduce((a, r) => a + r.selisih, 0);
    const totalPlus = rows.filter((r) => r.selisih > 0).reduce((a, r) => a + r.selisih, 0);

    return NextResponse.json({
      data: rows,
      summary: {
        count: rows.length,
        totalMinus, // negatif = total saldo hilang
        totalPlus,  // positif = total saldo kelebihan
      },
    });
  } catch (err) {
    console.error("Reconcile error:", err);
    return NextResponse.json({ error: "Gagal memuat rekonsiliasi" }, { status: 500 });
  }
}
