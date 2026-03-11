import { db } from "@/lib/db";
import { withApiAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export const GET = withApiAuth(async (_req, user) => {
    const userData = await db.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            balance: true,
            role: true,
            apiKey: true,
            webhookUrl: true,
            favorites: true,
            theme: true,
        },
    });

    if (!userData) {
        return apiError("User not found", 404, "USER_NOT_FOUND");
    }

    return apiSuccess({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        image: userData.image,
        phone: userData.phone,
        balance: userData.balance,
        role: userData.role,
        api_key: userData.apiKey,
        webhook_url: userData.webhookUrl,
        favorites: userData.favorites,
        theme: userData.theme,
    });
});
