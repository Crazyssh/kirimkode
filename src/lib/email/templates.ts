// Template renderer i18n untuk email KirimKode.
// Menyusun konten email (subject/html/text) untuk tiap jenis email dalam
// Bahasa Indonesia ("id") dan Inggris ("en").
//
// Requirements: 9.3 (broadcast menyertakan tautan opt-out), 13.1/13.2/13.3
// (i18n isi email dengan fallback "id").

export type Locale = "id" | "en";

export type EmailKind = "verify" | "reset" | "reset_oauth_hint" | "broadcast";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const APP_NAME = "KirimKode";

/**
 * Req 13.1/13.2/13.3: resolusi locale bersifat total.
 * Mengembalikan "en" jika dan hanya jika input tepat "en".
 * Semua nilai lain (termasuk null/undefined/string lain) → "id" (fallback default).
 */
export function resolveLocale(input?: string | null): Locale {
  return input === "en" ? "en" : "id";
}

/** Escape karakter HTML agar nilai dinamis aman dimasukkan ke markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bungkus konten body ke dalam layout HTML sederhana yang konsisten. */
function wrapHtml(title: string, bodyHtml: string): string {
  return [
    '<!DOCTYPE html>',
    '<html>',
    "<body style=\"margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;\">",
    "<div style=\"max-width:520px;margin:0 auto;padding:24px;\">",
    "<div style=\"background:#ffffff;border-radius:12px;padding:32px;\">",
    `<h1 style="margin:0 0 16px;font-size:20px;color:#4f46e5;">${escapeHtml(APP_NAME)}</h1>`,
    `<h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(title)}</h2>`,
    bodyHtml,
    "</div>",
    `<p style="margin:16px 0 0;font-size:12px;color:#71717a;text-align:center;">&copy; ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}</p>`,
    "</div>",
    "</body>",
    "</html>",
  ].join("");
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">${escapeHtml(label)}</a></p>`;
}

type Copy = {
  subject: string;
  title: string;
  intro: string;
  cta?: string;
  ctaVar?: string; // nama var yang memuat URL untuk tombol
  fallback?: string; // teks penjelas tautan salin-tempel
  outro?: string;
};

const COPY: Record<EmailKind, Record<Locale, Copy>> = {
  verify: {
    id: {
      subject: `Verifikasi email ${APP_NAME}`,
      title: "Verifikasi alamat email Anda",
      intro:
        "Terima kasih telah bergabung. Klik tombol di bawah untuk memverifikasi alamat email Anda. Tautan ini berlaku selama 24 jam.",
      cta: "Verifikasi Email",
      ctaVar: "verifyUrl",
      fallback: "Jika tombol tidak berfungsi, salin tautan berikut ke browser Anda:",
      outro: "Jika Anda tidak membuat akun ini, abaikan email ini.",
    },
    en: {
      subject: `Verify your ${APP_NAME} email`,
      title: "Verify your email address",
      intro:
        "Thanks for joining. Click the button below to verify your email address. This link is valid for 24 hours.",
      cta: "Verify Email",
      ctaVar: "verifyUrl",
      fallback: "If the button does not work, copy the following link into your browser:",
      outro: "If you did not create this account, please ignore this email.",
    },
  },
  reset: {
    id: {
      subject: `Reset password ${APP_NAME}`,
      title: "Atur ulang password Anda",
      intro:
        "Kami menerima permintaan untuk mengatur ulang password Anda. Klik tombol di bawah untuk membuat password baru. Tautan ini berlaku selama 60 menit.",
      cta: "Reset Password",
      ctaVar: "resetUrl",
      fallback: "Jika tombol tidak berfungsi, salin tautan berikut ke browser Anda:",
      outro:
        "Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.",
    },
    en: {
      subject: `Reset your ${APP_NAME} password`,
      title: "Reset your password",
      intro:
        "We received a request to reset your password. Click the button below to set a new password. This link is valid for 60 minutes.",
      cta: "Reset Password",
      ctaVar: "resetUrl",
      fallback: "If the button does not work, copy the following link into your browser:",
      outro:
        "If you did not request a password reset, please ignore this email. Your password will not change.",
    },
  },
  reset_oauth_hint: {
    id: {
      subject: `Reset password ${APP_NAME}`,
      title: "Akun Anda menggunakan login OAuth",
      intro:
        "Kami menerima permintaan reset password untuk akun ini. Akun Anda terdaftar melalui penyedia OAuth (misalnya Google) dan tidak memiliki password. Silakan masuk menggunakan tombol login OAuth pada halaman masuk.",
      outro: "Jika Anda tidak meminta hal ini, abaikan email ini.",
    },
    en: {
      subject: `Reset your ${APP_NAME} password`,
      title: "Your account uses OAuth sign-in",
      intro:
        "We received a password reset request for this account. Your account was registered through an OAuth provider (such as Google) and does not have a password. Please sign in using the OAuth login button on the sign-in page.",
      outro: "If you did not request this, please ignore this email.",
    },
  },
  broadcast: {
    id: {
      subject: "",
      title: "",
      intro: "",
    },
    en: {
      subject: "",
      title: "",
      intro: "",
    },
  },
};

function renderTransactional(copy: Copy, vars: Record<string, string>): RenderedEmail {
  const url = copy.ctaVar ? vars[copy.ctaVar] ?? "" : "";

  const htmlParts: string[] = [`<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(copy.intro)}</p>`];
  const textParts: string[] = [copy.intro];

  if (copy.cta && url) {
    htmlParts.push(button(url, copy.cta));
    if (copy.fallback) {
      htmlParts.push(
        `<p style="margin:0 0 8px;font-size:13px;color:#52525b;">${escapeHtml(copy.fallback)}</p>`,
        `<p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      );
      textParts.push(`${copy.fallback}\n${url}`);
    } else {
      textParts.push(url);
    }
  }

  if (copy.outro) {
    htmlParts.push(`<p style="margin:0;font-size:13px;color:#71717a;">${escapeHtml(copy.outro)}</p>`);
    textParts.push(copy.outro);
  }

  return {
    subject: copy.subject,
    html: wrapHtml(copy.title, htmlParts.join("")),
    text: textParts.join("\n\n"),
  };
}

function renderBroadcast(locale: Locale, vars: Record<string, string>): RenderedEmail {
  const subject = vars.subject ?? "";
  const body = vars.body ?? "";
  const optOutUrl = vars.optOutUrl ?? "";

  const optOutLabel =
    locale === "en" ? "Unsubscribe from these emails" : "Berhenti berlangganan email ini";
  const optOutNote =
    locale === "en"
      ? "You are receiving this because you are a registered user."
      : "Anda menerima email ini karena terdaftar sebagai pengguna.";

  // Req 9.3: konten HTML broadcast HARUS memuat tautan opt-out.
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br/>");
  const html = wrapHtml(
    subject,
    [
      `<div style="margin:0 0 24px;line-height:1.6;">${bodyHtml}</div>`,
      `<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;"/>`,
      `<p style="margin:0;font-size:12px;color:#71717a;">${escapeHtml(optOutNote)}<br/>`,
      `<a href="${escapeHtml(optOutUrl)}" style="color:#71717a;">${escapeHtml(optOutLabel)}</a></p>`,
    ].join(""),
  );

  const text = `${body}\n\n---\n${optOutNote}\n${optOutLabel}: ${optOutUrl}`;

  return { subject, html, text };
}

/**
 * Menyusun konten email untuk `kind` dalam `locale` tertentu.
 * `vars` memuat nilai dinamis: verifyUrl, resetUrl, optOutUrl, subject, body.
 */
export function renderEmail(
  kind: EmailKind,
  locale: Locale,
  vars: Record<string, string>,
): RenderedEmail {
  if (kind === "broadcast") {
    return renderBroadcast(locale, vars);
  }
  const copy = COPY[kind][locale];
  return renderTransactional(copy, vars);
}
