// ==================== MAIL (DISABLED) ====================
// Mailgun telah dihapus. Semua function tetap ada tapi skip kirim email.

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject }: SendMailOptions) {
  console.log(`[Mail] Email disabled, skipping: ${subject} → ${to}`);
  return null;
}

// ==================== SPECIFIC EMAILS (STUBS) ====================

export async function sendDepositSuccessEmail(to: string, data: { name: string; amount: number; trxId: string; balance: number }) {
  return sendMail({ to, subject: `Deposit Berhasil`, html: "" });
}

export async function sendDepositPendingEmail(to: string, data: { name: string; amount: number; trxId: string; channelName: string; payUrl: string; expiredAt?: string }) {
  return sendMail({ to, subject: `Deposit Pending`, html: "" });
}

export async function sendWelcomeEmail(to: string, data: { name: string }) {
  return sendMail({ to, subject: `Welcome`, html: "" });
}

export async function sendBroadcastEmail(to: string, data: { subject: string; content: string }) {
  return sendMail({ to, subject: data.subject, html: "" });
}
