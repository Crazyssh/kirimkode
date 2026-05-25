import { z } from "zod";

/**
 * Validasi semua environment variables saat startup.
 * Kalau ada yang kurang/salah, langsung throw error dengan pesan jelas.
 */
const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),

    // Auth
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET wajib diisi"),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),

    // Paymenku
    PAYMENKU_API_KEY: z.string().optional(),
    PAYMENKU_WEBHOOK_SECRET: z.string().optional(),
    PAYMENKU_BASE_URL: z.string().optional(),

    // JasaOTP
    JASA_OTP_API_KEY: z.string().optional(),

    // Provider 3
    PROVIDER3_API_KEY: z.string().optional(),

    // Provider 5 (Earth - mars.kirimkode.com)
    PROVIDER5_API_KEY: z.string().optional(),
    PROVIDER5_API_URL: z.string().optional(),

    // Provider 6 (Venus - 5sim.net)
    PROVIDER6_API_KEY: z.string().optional(),
    PROVIDER6_API_URL: z.string().optional(),

    // Turnstile
    TURNSTILE_SECRET_KEY: z.string().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

    // Cron
    CRON_SECRET: z.string().optional(),

    // Analytics
    NEXT_PUBLIC_GA_ID: z.string().optional(),

    // FingerprintJS
    NEXT_PUBLIC_FPJS_API_KEY: z.string().optional(),

    // Fonnte WhatsApp API
    FONNTE_API_TOKEN: z.string().optional(),

    // ShadowOTP
    SHADOW_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Get validated environment variables.
 * Throws descriptive error if required vars are missing.
 */
export function getEnv(): Env {
    if (_env) return _env;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const missing = result.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");

        console.error(
            `\n❌ Environment variables tidak valid:\n${missing}\n\nPastikan semua env vars sudah di-set di .env atau environment server.\n`
        );

        // Di production, throw error supaya app tidak jalan dengan config salah
        if (process.env.NODE_ENV === "production") {
            throw new Error("Missing required environment variables");
        }
    }

    _env = result.success ? result.data : (process.env as unknown as Env);
    return _env;
}

// Auto-validate saat module di-import
getEnv();
