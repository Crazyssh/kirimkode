import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, phone, webhookUrl, currentPassword, newPassword, favorites, theme } = body;

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
  if (favorites !== undefined) updateData.favorites = favorites;
  if (theme !== undefined && ["dark", "light"].includes(theme)) updateData.theme = theme;

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Password lama diperlukan" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user?.password) {
      return NextResponse.json({ error: "Akun OAuth tidak bisa ganti password" }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Password lama salah" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Tidak ada data yang diubah" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "settings_update",
      detail: JSON.stringify(Object.keys(updateData).filter((k) => k !== "password")),
    },
  });

  return NextResponse.json({ success: true, message: "Pengaturan berhasil disimpan" });
}
