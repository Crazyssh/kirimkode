/**
 * API route for linking Telegram account.
 * POST: generate OTP for verification
 * DELETE: unlink Telegram account
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username Telegram wajib diisi" }, { status: 400 });
    }

    // Clean username (remove @)
    const cleanUsername = username.replace(/^@/, "").trim();
    if (!cleanUsername) {
      return NextResponse.json({ error: "Username tidak valid" }, { status: 400 });
    }

    // Generate OTP (expires in 10 minutes)
    const otp = generateOtp();
    const otpExp = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: session.user.id },
      data: {
        telegramUsername: cleanUsername,
        telegramOtp: otp,
        telegramOtpExp: otpExp,
      },
    });

    return NextResponse.json({
      success: true,
      otp,
      message: `Kirim kode ${otp} ke bot @KirimKodeBot di Telegram`,
      expiresIn: "10 menit",
    });
  } catch (error) {
    console.error("Telegram link error:", error);
    return NextResponse.json({ error: "Gagal generate kode" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
        telegramOtp: null,
        telegramOtpExp: null,
      },
    });

    return NextResponse.json({ success: true, message: "Telegram berhasil di-unlink" });
  } catch (error) {
    console.error("Telegram unlink error:", error);
    return NextResponse.json({ error: "Gagal unlink" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
      },
    });

    return NextResponse.json({
      linked: !!user?.telegramId,
      username: user?.telegramUsername || null,
      linkedAt: user?.telegramLinkedAt || null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
