import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        role: true,
        status: true,
        banReason: true,
        apiKey: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            deposits: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [totalSpentAgg, totalDepositedAgg, recentOrders, recentDeposits] = await Promise.all([
      db.order.aggregate({
        where: { userId: id, status: "success" },
        _sum: { price: true },
      }),
      db.deposit.aggregate({
        where: { userId: id, status: "paid" },
        _sum: { amount: true },
      }),
      db.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.deposit.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      data: {
        ...user,
        stats: {
          totalSpent: totalSpentAgg._sum.price ?? 0,
          totalDeposited: totalDepositedAgg._sum.amount ?? 0,
        },
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          service: o.serviceName,
          number: o.number,
          code: o.code,
          price: o.price,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        })),
        recentDeposits: recentDeposits.map((d) => ({
          id: d.id,
          amount: d.amount,
          channel: d.channelName,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Admin user detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user: adminUser } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { balance, role, name, status, banReason, premiumChecker, newPassword } = body as {
      balance?: number;
      role?: string;
      name?: string;
      status?: string;
      banReason?: string;
      premiumChecker?: boolean;
      newPassword?: string;
    };

    // Proteksi: admin tidak boleh demote/ban diri sendiri
    if (adminUser && id === adminUser.id) {
      if ((role && role !== "admin") || (status && status === "banned")) {
        return NextResponse.json(
          { error: "Tidak bisa mengubah role atau ban akun sendiri" },
          { status: 400 }
        );
      }
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof balance === "number") {
      if (balance < 0) {
        return NextResponse.json({ error: "Balance tidak boleh negatif" }, { status: 400 });
      }
      data.balance = balance;
    }

    if (typeof role === "string") {
      if (role !== "user" && role !== "admin") {
        return NextResponse.json(
          { error: "Role must be 'user' or 'admin'" },
          { status: 400 }
        );
      }
      data.role = role;
    }

    if (typeof name === "string") {
      data.name = name;
    }

    if (typeof status === "string") {
      if (status !== "active" && status !== "banned") {
        return NextResponse.json(
          { error: "Status must be 'active' or 'banned'" },
          { status: 400 }
        );
      }
      data.status = status;
      if (status === "active") {
        data.banReason = null;
      }
    }

    if (typeof banReason === "string") {
      data.banReason = banReason;
    }

    if (typeof premiumChecker === "boolean") {
      data.premiumChecker = premiumChecker;
    }

    // Reset password oleh admin (opsional). Kalau diisi, hash dgn bcrypt + audit log.
    let passwordChanged = false;
    if (typeof newPassword === "string" && newPassword.length > 0) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password minimal 8 karakter" },
          { status: 400 }
        );
      }
      if (newPassword.length > 200) {
        return NextResponse.json(
          { error: "Password terlalu panjang" },
          { status: 400 }
        );
      }
      data.password = await bcrypt.hash(newPassword, 12);
      passwordChanged = true;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        balance: true,
        role: true,
        status: true,
        banReason: true,
        apiKey: true,
        premiumChecker: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log untuk reset password — TIDAK simpan password plaintext
    if (passwordChanged && adminUser?.id) {
      logAction(
        adminUser.id,
        "admin_reset_password",
        JSON.stringify({
          targetUserId: id,
          targetEmail: updatedUser.email,
        })
      );
      console.log(
        `[Admin] Password reset by ${adminUser.id} for user ${updatedUser.email}`
      );
    }

    return NextResponse.json({ data: updatedUser });
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
