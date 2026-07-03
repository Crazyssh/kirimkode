// Bot CS Telegram Business — auto-reply chat customer atas nama akun bisnismu.
// Tanpa framework: long-polling getUpdates + fetch (butuh Node 18+).
//
// Jalankan: BOT_TOKEN=xxxx node bot.mjs
// Atau via pm2 (lihat README.md).
//
// PENTING: bot harus di-Business Mode di BotFather DAN kamu connect bot ini ke
// akun bisnismu (Settings → Telegram Business → Chatbots → pilih bot).

import { findReply } from "./faq.mjs";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("BOT_TOKEN tidak di-set. Jalankan: BOT_TOKEN=xxxx node bot.mjs");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Jeda minimal antar auto-reply ke chat yang sama (anti-spam), ms.
const REPLY_COOLDOWN_MS = 15_000;
const lastReplyAt = new Map(); // chatId -> timestamp

// Owner id per business_connection (buat abaikan pesan yang KITA kirim sendiri).
const connectionOwner = new Map(); // businessConnectionId -> ownerUserId

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.warn(`[tg] ${method} gagal:`, data.description);
  }
  return data;
}

function handleBusinessConnection(conn) {
  // conn: { id, user: {id,...}, is_enabled, can_reply, ... }
  if (conn?.id && conn?.user?.id) {
    connectionOwner.set(conn.id, conn.user.id);
    const status = conn.is_enabled ? "aktif" : "nonaktif";
    console.log(`[conn] Business connection ${conn.id} (${status}) owner=${conn.user.id} can_reply=${conn.can_reply}`);
  }
}

async function handleBusinessMessage(msg) {
  const bcId = msg.business_connection_id;
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  const text = msg.text || msg.caption || "";
  if (!bcId || !chatId) return;

  // Abaikan pesan yang dikirim oleh OWNER akun bisnis sendiri (bukan customer).
  const ownerId = connectionOwner.get(bcId);
  if (ownerId && fromId === ownerId) return;

  // Cooldown per chat biar gak balas beruntun.
  const now = Date.now();
  const last = lastReplyAt.get(chatId) || 0;
  if (now - last < REPLY_COOLDOWN_MS) return;

  const reply = findReply(text);
  if (!reply) return;

  lastReplyAt.set(chatId, now);

  await tg("sendMessage", {
    business_connection_id: bcId,
    chat_id: chatId,
    text: reply,
    parse_mode: "Markdown",
  });
  console.log(`[reply] ke chat ${chatId}: "${text.slice(0, 40)}..."`);
}

async function processUpdate(update) {
  try {
    if (update.business_connection) {
      handleBusinessConnection(update.business_connection);
    } else if (update.business_message) {
      await handleBusinessMessage(update.business_message);
    }
    // edited_business_message / deleted_business_messages: diabaikan.
  } catch (e) {
    console.error("[update] error:", e.message);
  }
}

async function main() {
  console.log("Bot CS Telegram Business jalan. Menunggu update...");
  let offset = 0;

  // Bersihkan webhook (kalau ada) supaya long-polling jalan.
  await tg("deleteWebhook", { drop_pending_updates: false });

  while (true) {
    try {
      const res = await fetch(`${API}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset,
          timeout: 30,
          allowed_updates: ["business_connection", "business_message"],
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await processUpdate(update);
        }
      }
    } catch (e) {
      console.error("[poll] error, retry 3s:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main();
