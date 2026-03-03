import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    const user = await authenticateApiKey(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { server, id: orderId } = body;

        if (!server || !orderId) {
            return NextResponse.json(
                { error: "server and id are required" },
                { status: 400 }
            );
        }

        // Find the order and verify it belongs to this user
        const order = await db.order.findFirst({
            where: {
                orderId: Number(orderId),
                server,
                userId: user.id,
                status: "waiting",
            },
        });

        if (!order) {
            return NextResponse.json(
                { error: "Order not found or not cancellable" },
                { status: 404 }
            );
        }

        // Check 3-minute rule
        const createdAt = new Date(order.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        if (diffMs < 3 * 60 * 1000) {
            return NextResponse.json(
                { error: "Cannot cancel within 3 minutes of order" },
                { status: 400 }
            );
        }

        // Import and call the cancel function
        const { cancelOrder } = await import("@/lib/otp");

        let jasaotpError = false;
        try {
            await cancelOrder(server as "api1" | "api2", Number(orderId));
        } catch (e) {
            console.warn("[v1/cancel] JasaOTP error (proceeding with refund):", e);
            jasaotpError = true;
        }

        // Refund balance
        await db.$transaction([
            db.user.update({
                where: { id: user.id },
                data: { balance: { increment: order.price } },
            }),
            db.order.update({
                where: { id: order.id },
                data: { status: "cancelled" },
            }),
        ]);

        return NextResponse.json({
            status: "success",
            message: "Order cancelled and balance refunded",
            warning: jasaotpError ? "JasaOTP returned an error but refund was processed" : undefined,
        });
    } catch (error) {
        console.error("[v1/cancel] Error:", error);
        return NextResponse.json(
            { error: "Failed to cancel order" },
            { status: 500 }
        );
    }
}
