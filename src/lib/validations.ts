import { z } from "zod";

// ==================== AUTH ====================

export const registerSchema = z.object({
    name: z.string().min(1, "Nama wajib diisi").max(100),
    email: z.string().email("Email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    phone: z.string().optional().nullable(),
    captchaToken: z.string().optional(),
    referralCode: z.string().optional().nullable(),
});

// ==================== OTP ====================

export const otpOrderSchema = z.object({
    server: z.enum(["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9", "unified"], { message: "Server tidak valid" }),
    negara: z.union([z.number(), z.string()]).transform(Number),
    layanan: z.string().min(1, "Layanan wajib diisi"),
    operator: z.string().default("any"),
    serviceName: z.string().optional(),
    countryName: z.string().optional(),
});

export const otpCancelSchema = z.object({
    server: z.enum(["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9", "unified"], { message: "Server tidak valid" }),
    id: z.union([z.number(), z.string()]).transform(Number),
});

export const otpCheckNumberSchema = z.object({
    number: z.string().min(1, "Nomor wajib diisi"),
    type: z.enum(["wa", "tg"]).optional(),
});

// ==================== DEPOSIT ====================

export const depositCreateSchema = z.object({
    amount: z.number().min(1000, "Minimum deposit Rp 1.000").max(500_000, "Maksimum deposit Rp 500.000"),
    channel_code: z.string().min(1, "Pilih metode pembayaran"),
});

// ==================== USER ====================

export const userSettingsSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).optional().nullable(),
    webhookUrl: z.string().url().optional().nullable().or(z.literal("")),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "Password minimal 8 karakter").optional(),
    favorites: z.string().optional(),
    theme: z.enum(["dark", "light"]).optional(),
});

export const userFingerprintSchema = z.object({
    fingerprint: z.string().min(1).max(100),
});

// ==================== VOUCHER ====================

export const voucherApplySchema = z.object({
    code: z.string().min(1, "Kode voucher wajib diisi"),
    amount: z.number().min(0).optional(),
});

// ==================== ADMIN ====================

export const adminAnnouncementSchema = z.object({
    title: z.string().min(1, "Judul wajib diisi"),
    content: z.string().min(1, "Konten wajib diisi"),
    type: z.enum(["info", "warning", "success"]).default("info"),
    active: z.boolean().default(true),
});

export const adminPricingSchema = z.object({
    serviceCode: z.string().min(1),
    countryId: z.number().default(0),
    priceType: z.enum(["fixed", "multiply", "markup", "floor"]),
    value: z.number().min(0),
    active: z.boolean().default(true),
});

export const adminVoucherSchema = z.object({
    code: z.string().min(1).max(50),
    description: z.string().min(1),
    bonusType: z.enum(["fixed", "percent"]),
    bonusValue: z.number().min(0),
    maxBonus: z.number().default(0),
    minDeposit: z.number().default(0),
    maxUsage: z.number().default(0),
    maxPerUser: z.number().default(1),
    firstDeposit: z.boolean().default(false),
    active: z.boolean().default(true),
    expiresAt: z.string().datetime().optional().nullable(),
});

// ==================== V1 API ====================

export const v1OrderSchema = z.object({
    server: z.enum(["api1", "api2", "api3", "api4", "api5", "api6", "api7", "api8", "api9"]),
    country_id: z.union([z.number(), z.string()]).transform(Number),
    service: z.string().min(1),
    operator: z.string().default("any"),
});

// ==================== HELPER ====================

/**
 * Validate request body dengan Zod schema.
 * Return { success: true, data } atau { success: false, error: string }
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(body);
    if (!result.success) {
        const firstError = result.error.issues[0];
        return { success: false, error: firstError?.message || "Input tidak valid" };
    }
    return { success: true, data: result.data };
}
