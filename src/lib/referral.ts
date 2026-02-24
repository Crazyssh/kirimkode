import { db } from "@/lib/db";

const REFERRAL_COMMISSION_PERCENT = 5;

/**
 * Berikan komisi referral ke inviter saat deposit invitee berhasil.
 * Komisi = 5% dari nominal deposit.
 */
export async function giveReferralCommission(userId: string, depositAmount: number): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { referredBy: true },
    });

    if (!user?.referredBy) return;

    const commission = Math.floor((depositAmount * REFERRAL_COMMISSION_PERCENT) / 100);
    if (commission <= 0) return;

    await db.user.update({
      where: { id: user.referredBy },
      data: { balance: { increment: commission } },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[Referral] Commission Rp ${commission} given to ${user.referredBy} from deposit by ${userId}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[Referral] Failed to give commission:", error);
    }
  }
}
