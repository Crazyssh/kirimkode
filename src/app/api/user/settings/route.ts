import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// Blacklist IP ranges yang tidak boleh dijadikan webhook URL (anti-SSRF)
const BLOCKED_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
const BLOCKED_IP_PREFIXES = ["10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.",
  "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", "192.168.", "169.254."];

function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: true }; // empty = hapus webhook

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Format URL tidak valid" };
  }

  // Hanya izinkan https (http boleh untuk development)
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, error: "URL harus http atau https" };
  }

  // Block internal hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: "URL tidak boleh mengarah ke localhost" };
  }

  // Block private IP ranges
  if (BLOCKED_IP_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
    return { valid: false, error: "URL tidak boleh mengarah ke jaringan internal" };
  }

  return { valid: true };
}

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

  // Validasi webhook URL anti-SSRF
  if (webhookUrl !== undefined) {
    const urlCheck = isValidWebhookUrl(webhookUrl);
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    updateData.webhookUrl = webhookUrl || null;
  }

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

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
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
