// Render + kirim template email ASLI (src/lib/email/templates.ts) via SMTP.
// STARTTLS + AUTH LOGIN + multipart/alternative (text + html).
// Usage: node --env-file=.env scripts/test-templates.mjs recipient@example.com
import net from "node:net";
import tls from "node:tls";
// Node 24 bisa import .ts langsung (type stripping). templates.ts tanpa import lain.
import { renderEmail, resolveLocale } from "../src/lib/email/templates.ts";

const HOST = process.env.EMAIL_HOST;
const PORT = Number(process.env.EMAIL_PORT || 587);
const USER = process.env.EMAIL_USERNAME;
const PASS = process.env.EMAIL_PASSWORD;
const FROM = process.env.EMAIL_FROM;
const FROM_NAME = process.env.EMAIL_FROM_NAME || FROM;
const TO = process.argv[2];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kirimkode.com";

if (!HOST || !USER || !PASS || !FROM) {
  console.error("Missing EMAIL_* env vars (HOST/USERNAME/PASSWORD/FROM)");
  process.exit(1);
}
if (!TO) {
  console.error("Usage: node --env-file=.env scripts/test-templates.mjs recipient@example.com");
  process.exit(1);
}

function converse(socket) {
  let buffer = "";
  let resolver = null;
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    const last = lines.filter(Boolean).pop() || "";
    if (/^\d{3} /.test(last)) {
      const reply = buffer;
      buffer = "";
      const r = resolver;
      resolver = null;
      if (r) r(reply);
    }
  });
  return {
    read: () => new Promise((res) => { resolver = res; }),
    send: (cmd) => socket.write(cmd + "\r\n"),
    sendRaw: (data) => socket.write(data),
  };
}

function expect(reply, code) {
  if (!reply.trimStart().startsWith(String(code))) {
    throw new Error(`Expected ${code}, got: ${reply.trim()}`);
  }
}

function dotStuff(body) {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMessage(email) {
  const boundary = `=_kk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: "${FROM_NAME}" <${FROM}>`,
    `To: <${TO}>`,
    `Subject: ${email.subject}`,
    "MIME-Version: 1.0",
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(email.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(email.html),
    `--${boundary}--`,
  ].join("\r\n");
  return `${headers}\r\n\r\n${parts}\r\n.\r\n`;
}

// Satu koneksi TLS terautentikasi, kirim banyak email berurutan.
async function sendAll(emails) {
  console.log(`Connecting to ${HOST}:${PORT} ...`);
  const plain = net.connect(PORT, HOST);
  plain.setEncoding("utf8");
  await new Promise((res, rej) => { plain.once("connect", res); plain.once("error", rej); });

  let conv = converse(plain);
  expect(await conv.read(), 220);
  conv.send(`EHLO ${HOST}`);
  expect(await conv.read(), 250);
  conv.send("STARTTLS");
  expect(await conv.read(), 220);

  const secure = tls.connect({ socket: plain, servername: HOST });
  secure.setEncoding("utf8");
  await new Promise((res, rej) => { secure.once("secureConnect", res); secure.once("error", rej); });
  console.log(`TLS established: ${secure.getProtocol()}`);

  conv = converse(secure);
  conv.send(`EHLO ${HOST}`);
  expect(await conv.read(), 250);
  conv.send("AUTH LOGIN");
  expect(await conv.read(), 334);
  conv.send(Buffer.from(USER).toString("base64"));
  expect(await conv.read(), 334);
  conv.send(Buffer.from(PASS).toString("base64"));
  expect(await conv.read(), 235);
  console.log("✅ AUTH success\n");

  for (const { label, email } of emails) {
    conv.send(`MAIL FROM:<${FROM}>`);
    expect(await conv.read(), 250);
    conv.send(`RCPT TO:<${TO}>`);
    expect(await conv.read(), 250);
    conv.send("DATA");
    expect(await conv.read(), 354);
    conv.sendRaw(buildMessage(email));
    expect(await conv.read(), 250);
    console.log(`✅ Sent: ${label}  |  subject: "${email.subject}"`);
  }

  conv.send("QUIT");
  try { await conv.read(); } catch { /* ignore */ }
  secure.end();
  plain.end();
}

const locale = resolveLocale("id");
const emails = [
  {
    label: "verify (verifikasi email)",
    email: renderEmail("verify", locale, {
      verifyUrl: `${APP_URL}/verify-email?token=demo-verify-token-123`,
    }),
  },
  {
    label: "reset (reset password)",
    email: renderEmail("reset", locale, {
      resetUrl: `${APP_URL}/reset-password?token=demo-reset-token-456`,
    }),
  },
  {
    label: "reset_oauth_hint (akun OAuth)",
    email: renderEmail("reset_oauth_hint", locale, {}),
  },
  {
    label: "broadcast (marketing)",
    email: renderEmail("broadcast", locale, {
      subject: "Promo Spesial KirimKode 🎉",
      body: "Halo!\n\nNikmati harga nomor virtual termurah minggu ini.\nBuka aplikasi sekarang dan cek promonya.",
      optOutUrl: `${APP_URL}/api/email/opt-out?token=demo-optout-token-789`,
    }),
  },
];

sendAll(emails)
  .then(() => { console.log("\nSelesai. Cek inbox (dan folder Promotions/Spam)."); process.exit(0); })
  .catch((err) => { console.error(`\n❌ FAILED: ${err.message}`); process.exit(1); });
