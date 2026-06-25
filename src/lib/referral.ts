import { db } from "@/lib/db";

const REFERRAL_COMMISSION_PERCENT = 5;

/**
 * Berikan komisi referral ke inviter — HANYA saat deposit PERTAMA invitee berhasil.
 * Komisi = 5% dari nominal deposit pertama.
 *
 * Catatan: fungsi ini dipanggil SETELAH deposit di-mark "paid", jadi deposit
 * pertama = total deposit paid invitee == 1.
 */
export async function giveReferralCommission(userId: string, depositAmount: number): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { referredBy: true },
    });

    if (!user?.referredBy) return;

    // Cuma deposit PERTAMA yang dapat komisi. Kalau invitee sudah punya >1 deposit
    // paid, berarti ini bukan deposit pertama → skip.
    const paidCount = await db.deposit.count({
      where: { userId, status: "paid" },
    });
    if (paidCount !== 1) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[Referral] Skip: deposit ke-${paidCount} (bukan pertama) oleh ${userId}`);
      }
      return;
    }

    const commission = Math.floor((depositAmount * REFERRAL_COMMISSION_PERCENT) / 100);
    if (commission <= 0) return;

    await db.user.update({
      where: { id: user.referredBy },
      data: { balance: { increment: commission } },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[Referral] Commission Rp ${commission} given to ${user.referredBy} from FIRST deposit by ${userId}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Referral] Failed to give commission:", error);
    }
  }
}
