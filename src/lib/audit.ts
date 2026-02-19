import { db } from "@/lib/db";

export async function logAction(
  userId: string,
  action: string,
  detail?: string,
  ip?: string
) {
  try {
    await db.auditLog.create({
      data: { userId, action, detail, ip },
    });
  } catch {
    // silent - audit log should never break main flow
  }
}
