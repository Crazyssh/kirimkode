import { db } from "@/lib/db";
import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/api-response";

export const GET = withApiAuth(async (_req, user) => {
  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: { balance: true },
  });

  return apiSuccess({
    balance: userData?.balance ?? 0,
    currency: "IDR",
  });
});
