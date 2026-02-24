import { db } from "@/lib/db";
import { headers } from "next/headers";

/**
 * Extract IP from request headers (Next.js server context)
 */
export async function getClientIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim()
      || h.get("x-real-ip")
      || undefined;
  } catch {
    return undefined;
  }
}

export async function logAction(
  userId: string,
  action: string,
  detail?: string,
  ip?: string
) {
  try {
    const clientIp = ip || await getClientIp();
    await db.auditLog.create({
      data: { userId, action, detail, ip: clientIp },
    });
  } catch {
    // silent - audit log should never break main flow
  }
}
