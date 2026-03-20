import Mailgun from "mailgun.js";
import formData from "form-data";

const DOMAIN = process.env.MAILGUN_DOMAIN || "kirimkode.com";
const API_KEY = process.env.MAILGUN_API_KEY || "";
const FROM_EMAIL = process.env.MAILGUN_FROM || "KirimKode <noreply@kirimkode.com>";

// Lazy init: supaya tidak crash saat build ketika API_KEY kosong
let _mg: ReturnType<InstanceType<typeof Mailgun>["client"]> | null = null;
function getMg() {
  if (!_mg) {
    const mailgun = new Mailgun(formData);
    _mg = mailgun.client({ username: "api", key: API_KEY || "dummy" });
  }
  return _mg;
}

// ==================== SEND EMAIL ====================

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: SendMailOptions) {
  if (!API_KEY) {
    console.warn("[Mail] MAILGUN_API_KEY not set, skipping email");
    return null;
  }

  try {
    const result = await getMg().messages.create(DOMAIN, {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
      text: text || subject,
    });
    console.log(`[Mail] Sent to ${to}: ${subject} (${result.id})`);
    return result;
  } catch (error) {
    console.error(`[Mail] Failed to send to ${to}:`, error);
    return null;
  }
}

// ==================== EMAIL TEMPLATES ====================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:24px;font-weight:700;color:#E2E8F0;">Kirim</span><span style="font-size:24px;font-weight:700;color:#00E676;">Kode</span>
    </div>
    
    <!-- Card -->
    <div style="background:#1E293B;border-radius:16px;padding:32px;border:1px solid #334155;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#64748B;font-size:12px;margin:0;">
        © ${new Date().getFullYear()} KirimKode · <a href="https://kirimkode.com" style="color:#00E676;text-decoration:none;">kirimkode.com</a>
      </p>
      <p style="color:#475569;font-size:11px;margin:8px 0 0;">
        Email ini dikirim otomatis, tidak perlu dibalas.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatWaktu(date?: Date | string | null): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " WIB";
}

// ==================== SPECIFIC EMAILS ====================

/** Email: Deposit berhasil / saldo masuk */
export async function sendDepositSuccessEmail(to: string, data: { name: string; amount: number; trxId: string; balance: number }) {
  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:56px;height:56px;border-radius:50%;background:#00E676;display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;color:#0F172A;font-weight:bold;">&#10003;</span>
      </div>
    </div>
    <h2 style="color:#E2E8F0;text-align:center;margin:0 0 8px;font-size:20px;">Deposit Berhasil!</h2>
    <p style="color:#94A3B8;text-align:center;margin:0 0 24px;font-size:14px;">
      Saldo Anda sudah ditambahkan
    </p>
    <div style="background:#0F172A;border-radius:12px;padding:16px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Nominal</td>
          <td style="color:#00E676;font-size:13px;padding:6px 0;text-align:right;font-weight:700;">+${formatRp(data.amount)}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">ID Transaksi</td>
          <td style="color:#E2E8F0;font-size:12px;padding:6px 0;text-align:right;font-family:monospace;">${data.trxId}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Waktu</td>
          <td style="color:#E2E8F0;font-size:13px;padding:6px 0;text-align:right;">${formatWaktu()}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Saldo Sekarang</td>
          <td style="color:#E2E8F0;font-size:13px;padding:6px 0;text-align:right;font-weight:700;">${formatRp(data.balance)}</td>
        </tr>
      </table>
    </div>
    <a href="https://kirimkode.com/buy" style="display:block;text-align:center;background:#00E676;color:#0F172A;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
      Beli Nomor OTP Sekarang &rarr;
    </a>
  `);

  return sendMail({
    to,
    subject: `✅ Deposit ${formatRp(data.amount)} Berhasil — KirimKode`,
    html,
  });
}

/** Email: Deposit pending / menunggu pembayaran */
export async function sendDepositPendingEmail(to: string, data: { name: string; amount: number; trxId: string; channelName: string; payUrl: string; expiredAt?: string }) {
  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(251,191,36,0.2);display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">&#9202;</span>
      </div>
    </div>
    <h2 style="color:#E2E8F0;text-align:center;margin:0 0 8px;font-size:20px;">Menunggu Pembayaran</h2>
    <p style="color:#94A3B8;text-align:center;margin:0 0 24px;font-size:14px;">
      Segera selesaikan pembayaran deposit Anda
    </p>
    <div style="background:#0F172A;border-radius:12px;padding:16px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Nominal</td>
          <td style="color:#FBBF24;font-size:13px;padding:6px 0;text-align:right;font-weight:700;">${formatRp(data.amount)}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Metode</td>
          <td style="color:#E2E8F0;font-size:13px;padding:6px 0;text-align:right;">${data.channelName}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">ID Transaksi</td>
          <td style="color:#E2E8F0;font-size:12px;padding:6px 0;text-align:right;font-family:monospace;">${data.trxId}</td>
        </tr>
        <tr>
          <td style="color:#94A3B8;font-size:13px;padding:6px 0;">Waktu</td>
          <td style="color:#E2E8F0;font-size:13px;padding:6px 0;text-align:right;">${formatWaktu()}</td>
        </tr>
      </table>
    </div>
    <a href="${data.payUrl}" style="display:block;text-align:center;background:#FBBF24;color:#0F172A;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
      Bayar Sekarang &rarr;
    </a>
    <p style="color:#64748B;font-size:11px;text-align:center;margin:12px 0 0;">
      Selesaikan pembayaran sebelum batas waktu agar deposit tidak expired.
    </p>
  `);

  return sendMail({
    to,
    subject: `⏳ Deposit ${formatRp(data.amount)} Menunggu Pembayaran — KirimKode`,
    html,
  });
}

/** Email: Welcome / registrasi berhasil */
export async function sendWelcomeEmail(to: string, data: { name: string }) {
  const html = baseTemplate(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(0,230,118,0.2);display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-size:28px;">👋</span>
      </div>
    </div>
    <h2 style="color:#E2E8F0;text-align:center;margin:0 0 8px;font-size:20px;">Selamat Datang, ${data.name}!</h2>
    <p style="color:#94A3B8;text-align:center;margin:0 0 24px;font-size:14px;">
      Akun KirimKode Anda sudah siap digunakan
    </p>
    <div style="background:#0F172A;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="color:#94A3B8;font-size:13px;margin:0 0 12px;">Dengan KirimKode, Anda bisa:</p>
      <p style="color:#E2E8F0;font-size:13px;margin:0 0 8px;">⚡ Beli nomor virtual dari 200+ negara</p>
      <p style="color:#E2E8F0;font-size:13px;margin:0 0 8px;">🔒 Verifikasi WhatsApp, Telegram, dll</p>
      <p style="color:#E2E8F0;font-size:13px;margin:0 0 8px;">💸 Harga mulai dari Rp 500</p>
      <p style="color:#E2E8F0;font-size:13px;margin:0;">🔄 Refund otomatis jika OTP gagal</p>
    </div>
    <a href="https://kirimkode.com/deposit" style="display:block;text-align:center;background:#00E676;color:#0F172A;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
      Deposit & Mulai Sekarang →
    </a>
  `);

  return sendMail({
    to,
    subject: `👋 Selamat Datang di KirimKode, ${data.name}!`,
    html,
  });
}

/** Email: Broadcast / pengumuman dari admin */
export async function sendBroadcastEmail(to: string, data: { subject: string; content: string }) {
  const html = baseTemplate(`
    <div style="color:#E2E8F0;font-size:14px;line-height:1.7;">
      ${data.content}
    </div>
  `);

  return sendMail({
    to,
    subject: data.subject,
    html,
  });
}
