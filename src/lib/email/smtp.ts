// SMTP_Sender — adapter koneksi SMTP (STARTTLS + AUTH LOGIN) memakai Node built-ins.
//
// Diadaptasi dari pola yang sudah terbukti di `scripts/test-smtp.mjs`:
//   EHLO -> STARTTLS -> upgrade TLS -> EHLO -> AUTH LOGIN -> MAIL/RCPT/DATA
//
// Kontrak (design.md, bagian SMTP_Sender):
//   - Menegakkan koneksi terenkripsi TLS sebelum AUTH (Req 11.5).
//   - Menangkap SEMUA error koneksi/protokol/timeout dan mengembalikannya sebagai
//     `{ ok: false, reason }` — TIDAK PERNAH melempar (Req 12.1).

import net from "node:net";
import tls from "node:tls";
import type { SmtpConfig } from "@/lib/email/config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  reason?: string; // pesan kegagalan untuk log (bukan untuk user mentah)
}

// Batas waktu keseluruhan (ms) agar koneksi/protokol yang menggantung tidak
// memblokir pemanggil tanpa batas.
const SOCKET_TIMEOUT_MS = 15_000;

type SmtpSocket = net.Socket | tls.TLSSocket;

/**
 * Membungkus sebuah socket menjadi antarmuka percakapan SMTP yang membaca
 * balasan lengkap (menangani balasan multiline yang berakhir dengan "NNN ").
 */
function converse(socket: SmtpSocket) {
  let buffer = "";
  let resolver: ((reply: string) => void) | null = null;
  let rejecter: ((err: Error) => void) | null = null;

  const fail = (err: Error) => {
    const rj = rejecter;
    resolver = null;
    rejecter = null;
    if (rj) rj(err);
  };

  socket.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    // Balasan lengkap diakhiri baris seperti "250 text" (spasi setelah kode).
    const last = lines.filter(Boolean).pop() || "";
    if (/^\d{3} /.test(last)) {
      const reply = buffer;
      buffer = "";
      const rs = resolver;
      resolver = null;
      rejecter = null;
      if (rs) rs(reply);
    }
  });

  socket.on("error", (err: Error) => fail(err));
  socket.on("close", () => fail(new Error("Connection closed unexpectedly")));
  socket.on("timeout", () => fail(new Error("SMTP socket timeout")));

  return {
    read: (): Promise<string> =>
      new Promise<string>((res, rej) => {
        resolver = res;
        rejecter = rej;
      }),
    send: (cmd: string): void => {
      socket.write(cmd + "\r\n");
    },
    sendRaw: (data: string): void => {
      socket.write(data);
    },
  };
}

function expect(reply: string, code: number): void {
  if (!reply.trimStart().startsWith(String(code))) {
    throw new Error(`Expected ${code}, got: ${reply.trim()}`);
  }
}

/**
 * Escaping "dot-stuffing" sesuai RFC 5321: baris yang diawali "." digandakan
 * agar tidak dianggap sebagai terminator DATA.
 */
function dotStuff(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

/**
 * Menyusun pesan MIME multipart/alternative (text + html) dengan header lengkap.
 */
function buildMessage(email: OutgoingEmail, cfg: SmtpConfig): string {
  const boundary = `=_kk_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const headers = [
    `From: "${cfg.fromName}" <${cfg.from}>`,
    `To: <${email.to}>`,
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

/**
 * Mengirim satu email melalui SMTP dengan STARTTLS + AUTH LOGIN.
 * Selalu mengembalikan SendResult; tidak pernah melempar.
 */
export async function sendViaSmtp(
  email: OutgoingEmail,
  cfg: SmtpConfig
): Promise<SendResult> {
  let plain: net.Socket | null = null;
  let secure: tls.TLSSocket | null = null;

  try {
    // 1. Koneksi plaintext + tunggu greeting 220.
    plain = net.connect(cfg.port, cfg.host);
    plain.setEncoding("utf8");
    plain.setTimeout(SOCKET_TIMEOUT_MS);

    const plainSock = plain;
    await new Promise<void>((res, rej) => {
      plainSock.once("connect", () => res());
      plainSock.once("error", rej);
      plainSock.once("timeout", () =>
        rej(new Error("Connection timeout to SMTP host"))
      );
    });

    let conv = converse(plainSock);
    expect(await conv.read(), 220); // greeting

    // 2. EHLO — pastikan STARTTLS diiklankan sebelum lanjut.
    conv.send(`EHLO ${cfg.host}`);
    const ehlo = await conv.read();
    expect(ehlo, 250);
    if (!/STARTTLS/i.test(ehlo)) {
      throw new Error("Server does not advertise STARTTLS");
    }

    // 3. STARTTLS -> upgrade ke TLS.
    conv.send("STARTTLS");
    expect(await conv.read(), 220);

    secure = tls.connect({ socket: plainSock, servername: cfg.host });
    secure.setEncoding("utf8");
    secure.setTimeout(SOCKET_TIMEOUT_MS);

    const secureSock = secure;
    await new Promise<void>((res, rej) => {
      secureSock.once("secureConnect", () => res());
      secureSock.once("error", rej);
      secureSock.once("timeout", () => rej(new Error("TLS handshake timeout")));
    });

    // Req 11.5: AUTH hanya dilakukan SETELAH koneksi terenkripsi TLS.
    if (!secureSock.encrypted) {
      throw new Error("TLS connection not established before AUTH");
    }

    // 4. EHLO ulang di atas kanal terenkripsi.
    conv = converse(secureSock);
    conv.send(`EHLO ${cfg.host}`);
    expect(await conv.read(), 250);

    // 5. AUTH LOGIN (username & password base64) di atas TLS.
    conv.send("AUTH LOGIN");
    expect(await conv.read(), 334);
    conv.send(Buffer.from(cfg.username).toString("base64"));
    expect(await conv.read(), 334);
    conv.send(Buffer.from(cfg.password).toString("base64"));
    expect(await conv.read(), 235);

    // 6. MAIL FROM / RCPT TO / DATA.
    conv.send(`MAIL FROM:<${cfg.from}>`);
    expect(await conv.read(), 250);
    conv.send(`RCPT TO:<${email.to}>`);
    expect(await conv.read(), 250);
    conv.send("DATA");
    expect(await conv.read(), 354);

    conv.sendRaw(buildMessage(email, cfg));
    expect(await conv.read(), 250);

    // 7. QUIT (best-effort).
    conv.send("QUIT");
    try {
      await conv.read();
    } catch {
      /* abaikan balasan QUIT */
    }

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, reason };
  } finally {
    try {
      secure?.destroy();
    } catch {
      /* noop */
    }
    try {
      plain?.destroy();
    } catch {
      /* noop */
    }
  }
}
