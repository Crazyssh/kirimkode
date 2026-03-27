import { getEnv } from "@/lib/env";

/**
 * Kirim pesan WhatsApp via Fonnte API
 * Docs: https://fonnte.com/api
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const token = getEnv().FONNTE_API_TOKEN;

  if (!token) {
    console.error("[WhatsApp] FONNTE_API_TOKEN belum di-set");
    return { success: false, error: "WhatsApp API belum dikonfigurasi" };
  }

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: new URLSearchParams({
        target: phone,
        message,
        countryCode: "62",
      }),
    });

    const data = await res.json();

    if (data.status === true || data.status === "true") {
      return { success: true };
    }

    console.error("[WhatsApp] Fonnte error:", data);
    return { success: false, error: data.reason || "Gagal mengirim pesan" };
  } catch (err) {
    console.error("[WhatsApp] Request error:", err);
    return { success: false, error: "Gagal menghubungi WhatsApp API" };
  }
}

/**
 * Kirim OTP verifikasi via WhatsApp
 */
export async function sendOtpWhatsApp(phone: string, otp: string) {
  const message = `[KirimKode] Kode verifikasi kamu: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan ke siapapun.`;
  return sendWhatsAppMessage(phone, message);
}
