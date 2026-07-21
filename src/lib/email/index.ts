// Email_Service — orkestrasi pengiriman email (email-service).
//
// Menyusun konten (delegasi ke `renderEmail`), memanggil `sendViaSmtp`,
// menegakkan kill switch (`isEmailEnabled`), dan meredaksi log.
//
// Kontrak (design.md, bagian Email_Service):
//   - Jika email dinonaktifkan → outcome `disabled` TANPA menyentuh jaringan (Req 14.3).
//   - Sukses → `sent`; gagal → `failed` + log kegagalan TANPA nilai token (Req 11.3, 12.1).
//   - TIDAK PERNAH melempar exception ke pemanggil (Req 12.3, 14.2).

import { getSmtpConfig, isEmailEnabled } from "@/lib/email/config";
import { sendViaSmtp } from "@/lib/email/smtp";
import { renderEmail, type EmailKind, type Locale } from "@/lib/email/templates";

export interface DeliveryOutcome {
  status: "sent" | "failed" | "disabled";
  reason?: string;
}

export interface DeliverEmailParams {
  to: string;
  kind: EmailKind;
  locale: Locale;
  vars: Record<string, string>;
}

/**
 * Menyusun dan mengirim satu email sebagai efek samping best-effort.
 *
 * Alur:
 *   1. Kill switch — jika email nonaktif, kembalikan `disabled` tanpa I/O jaringan (Req 14.3).
 *   2. Render konten via `renderEmail`, kirim via `sendViaSmtp`.
 *   3. Sukses → `sent`; gagal → catat log (tanpa nilai token) + kembalikan `failed`.
 *
 * Fungsi ini SELALU selesai dengan sebuah outcome dan tidak pernah melempar,
 * sehingga kegagalan email tidak merambat ke alur bisnis inti (Req 12.3, 14.2).
 */
export async function deliverEmail(
  params: DeliverEmailParams
): Promise<DeliveryOutcome> {
  const { to, kind, locale, vars } = params;

  try {
    // 1. Kill switch (Req 14.3): jangan sentuh jaringan bila email dinonaktifkan.
    if (!(await isEmailEnabled())) {
      return { status: "disabled" };
    }

    // getSmtpConfig() dijamin non-null saat isEmailEnabled() true, tetapi
    // periksa ulang secara defensif agar tidak pernah melempar.
    const cfg = getSmtpConfig();
    if (cfg == null) {
      return { status: "disabled" };
    }

    // 2. Susun konten email.
    const rendered = renderEmail(kind, locale, vars);

    // 3. Kirim via SMTP (sendViaSmtp sendiri tidak pernah melempar).
    const result = await sendViaSmtp(
      {
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      cfg
    );

    if (result.ok) {
      return { status: "sent" };
    }

    // Kegagalan pengiriman: catat log TANPA nilai token/URL bertoken (Req 11.3, 12.1).
    // Hanya `kind` dan `reason` protokol SMTP yang dicatat; `vars` (memuat
    // verifyUrl/resetUrl/optOutUrl bertoken) TIDAK PERNAH dimasukkan ke log.
    const reason = result.reason ?? "Unknown SMTP failure";
    console.error(`[Email] Failed to send "${kind}" email: ${reason}`);
    return { status: "failed", reason };
  } catch (err) {
    // Jaring pengaman terakhir: apa pun yang gagal tak terduga (mis. render)
    // tetap dipetakan ke outcome `failed`, bukan exception (Req 12.3, 14.2).
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[Email] Unexpected error sending "${kind}" email: ${reason}`);
    return { status: "failed", reason };
  }
}
