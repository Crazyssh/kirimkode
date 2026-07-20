// Self-contained SMTP test (STARTTLS + AUTH LOGIN) using Node built-ins only.
// Usage: node scripts/test-smtp.mjs [recipient@example.com]
import net from 'node:net';
import tls from 'node:tls';

const HOST = process.env.EMAIL_HOST || 'smtp.zeptomail.com';
const PORT = Number(process.env.EMAIL_PORT || 587);
const USER = process.env.EMAIL_USERNAME || 'emailapikey';
const PASS = process.env.EMAIL_PASSWORD;
const FROM = process.env.EMAIL_FROM || 'spaceAI@vconnct.info';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Space AI';
const TO = process.argv[2] || null; // optional: actually send a test email

if (!PASS) {
  console.error('Missing EMAIL_PASSWORD env var');
  process.exit(1);
}

function log(dir, line) {
  console.log(`${dir} ${line}`);
}

// Send a command and wait for a full SMTP reply (handles multiline replies).
function converse(socket) {
  let buffer = '';
  let resolver = null;

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    // A complete reply ends with a line like "250 text" (space after code).
    const last = lines.filter(Boolean).pop() || '';
    if (/^\d{3} /.test(last)) {
      const reply = buffer;
      buffer = '';
      const r = resolver;
      resolver = null;
      reply.split(/\r?\n/).filter(Boolean).forEach((l) => log('S:', l));
      if (r) r(reply);
    }
  });

  return {
    read: () => new Promise((res) => { resolver = res; }),
    send: (cmd, redact = false) => {
      log('C:', redact ? '<redacted>' : cmd);
      socket.write(cmd + '\r\n');
    },
  };
}

function expect(reply, code) {
  const ok = reply.trimStart().startsWith(String(code));
  if (!ok) throw new Error(`Expected ${code}, got: ${reply.trim()}`);
}

async function run() {
  console.log(`Connecting to ${HOST}:${PORT} ...`);
  const plain = net.connect(PORT, HOST);
  plain.setEncoding('utf8');
  await new Promise((res, rej) => {
    plain.once('connect', res);
    plain.once('error', rej);
  });

  let conv = converse(plain);
  expect(await conv.read(), 220); // greeting

  conv.send(`EHLO ${HOST}`);
  const ehlo = await conv.read();
  expect(ehlo, 250);
  if (!/STARTTLS/i.test(ehlo)) throw new Error('Server does not advertise STARTTLS');

  conv.send('STARTTLS');
  expect(await conv.read(), 220);

  console.log('Upgrading connection to TLS ...');
  const secure = tls.connect({ socket: plain, servername: HOST });
  secure.setEncoding('utf8');
  await new Promise((res, rej) => {
    secure.once('secureConnect', res);
    secure.once('error', rej);
  });
  console.log(`TLS established: ${secure.getProtocol()} / ${secure.getCipher().name}`);

  conv = converse(secure);
  conv.send(`EHLO ${HOST}`);
  expect(await conv.read(), 250);

  conv.send('AUTH LOGIN');
  expect(await conv.read(), 334);
  conv.send(Buffer.from(USER).toString('base64'));
  expect(await conv.read(), 334);
  conv.send(Buffer.from(PASS).toString('base64'), true);
  expect(await conv.read(), 235);
  console.log('\n✅ SMTP authentication SUCCESS');

  if (TO) {
    console.log(`\nSending test email to ${TO} ...`);
    conv.send(`MAIL FROM:<${FROM}>`);
    expect(await conv.read(), 250);
    conv.send(`RCPT TO:<${TO}>`);
    expect(await conv.read(), 250);
    conv.send('DATA');
    expect(await conv.read(), 354);
    const msg = [
      `From: "${FROM_NAME}" <${FROM}>`,
      `To: <${TO}>`,
      `Subject: SMTP test ${new Date().toISOString()}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'This is a test email confirming SMTP works.',
      '.',
    ].join('\r\n');
    secure.write(msg + '\r\n');
    expect(await conv.read(), 250);
    console.log('✅ Test email accepted by server');
  }

  conv.send('QUIT');
  try { await conv.read(); } catch { /* ignore */ }
  secure.end();
  plain.end();
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(`\n❌ FAILED: ${err.message}`);
  process.exit(1);
});
