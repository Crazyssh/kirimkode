// Marketing_Service — pembuatan, penargetan, dan pengiriman broadcast email
// marketing (email-service, Req 8, 9, 10).
//
// Tanggung jawab:
//   - `createBroadcast`: otorisasi admin + validasi field wajib, lalu simpan
//     broadcast beserta definisi segmen penerima.
//   - `sendBroadcast`: resolusi penerima segmen (all/subset) dikurangi penerima
//     opt-out, render + kirim per penerima dengan tautan opt-out unik, catat
//     status sent/failed + alasan, dan kembalikan ringkasan total/sent/failed.
//   - `optOut`/`resubscribe`: set/hapus status `marketingOptOut` user berdasarkan
//     token opt-out stabil pada tautan email (tanpa perlu login).
//
// Pengiriman email bersifat best-effort & non-blocking (delegasi ke
// `deliverEmail`), sehingga kegagalan SMTP tidak melempar ke pemanggil.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { deliverEmail } from "@/lib/email/index";
import { resolveLocale } from "@/lib/email/templates";
import { APP_URL } from "@/lib/email/config";

/** Definisi segmen penerima broadcast (Req 8.2). */
export type Segment = { type: "all" } | { type: "subset"; userIds: string[] };

export type CreateBroadcastResult =
  | { ok: true; broadcastId: string }
  | { ok: false; code: "FORBIDDEN" | "MISSING_FIELDS" };

export interface SendSummary {
  total: number;
  sent: number;
  failed: number;
}

export type SendBroadcastResult =
  | { ok: true; summary: SendSummary }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" };

/**
 * Membuat broadcast baru beserta segmen penerimanya.
 *
 * Aturan (design.md, Marketing_Service):
 *   - Aktor bukan admin → `FORBIDDEN` (Req 8.3).
 *   - Subjek atau isi kosong setelah `trim()` → `MISSING_FIELDS` (Req 8.4).
 *   - Selain itu simpan broadcast + segmen (Req 8.1, 8.2) lalu kembalikan
 *     `broadcastId`. `segmentData` menyimpan JSON `userIds` untuk segmen subset,
 *     atau array kosong untuk segmen `all`.
 */
export async function createBroadcast(
  actor: { id: string; role: string },
  input: { subject: string; body: string; segment: Segment },
): Promise<CreateBroadcastResult> {
  // Req 8.3: hanya admin yang boleh membuat broadcast.
  if (actor.role !== "admin") {
    return { ok: false, code: "FORBIDDEN" };
  }

  // Req 8.4: subjek dan isi wajib non-kosong (setelah trim).
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject === "" || body === "") {
    return { ok: false, code: "MISSING_FIELDS" };
  }

  // Req 8.1/8.2: simpan broadcast beserta definisi segmen.
  const segment = input.segment;
  const segmentData = JSON.stringify(
    segment.type === "subset" ? segment.userIds : [],
  );

  const broadcast = await db.broadcast.create({
    data: {
      subject,
      body,
      segmentType: segment.type,
      segmentData,
      status: "draft",
      createdBy: actor.id,
    },
    select: { id: true },
  });

  return { ok: true, broadcastId: broadcast.id };
}

/**
 * Mengirim broadcast ke seluruh penerima segmen yang tidak berstatus opt-out.
 *
 * Aturan (design.md, Marketing_Service):
 *   - Aktor bukan admin → `FORBIDDEN` (Req 8.3).
 *   - Broadcast tidak ditemukan → `NOT_FOUND`.
 *   - Resolusi penerima: segmen `all` = seluruh user; segmen `subset` = irisan
 *     `userIds` dengan user valid. Kecualikan penerima `marketingOptOut = true`
 *     (Req 9.1, 9.2).
 *   - Tiap penerima: pastikan punya `optOutToken` stabil (buat bila null &
 *     persist), susun `optOutUrl` unik, kirim email broadcast dengan tautan
 *     opt-out (Req 9.3), catat status `sent`/`failed` + alasan (Req 10.1, 10.2).
 *   - Perbarui tally broadcast (`totalCount/sentCount/failedCount`, status,
 *     `sentAt`) dan kembalikan ringkasan dengan invarian `sent + failed = total`
 *     (Req 10.3).
 */
export async function sendBroadcast(
  actor: { id: string; role: string },
  broadcastId: string,
): Promise<SendBroadcastResult> {
  // Req 8.3: hanya admin yang boleh mengirim broadcast.
  if (actor.role !== "admin") {
    return { ok: false, code: "FORBIDDEN" };
  }

  const broadcast = await db.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      id: true,
      subject: true,
      body: true,
      segmentType: true,
      segmentData: true,
    },
  });

  if (!broadcast) {
    return { ok: false, code: "NOT_FOUND" };
  }

  // Resolusi penerima dari definisi segmen.
  const recipients = await resolveRecipients(
    broadcast.segmentType,
    broadcast.segmentData,
  );

  const now = new Date();
  let sent = 0;
  let failed = 0;

  // Tandai broadcast sedang dikirim.
  await db.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "sending" },
  });

  for (const recipient of recipients) {
    // Pastikan penerima punya optOutToken stabil untuk tautan opt-out unik.
    const optOutToken = await ensureOptOutToken(recipient.id, recipient.optOutToken);
    const optOutUrl = `${APP_URL}/api/email/opt-out?token=${optOutToken}`;

    // Req 9.3/10.1/10.2: kirim email broadcast, catat status per penerima.
    const outcome = await deliverEmail({
      to: recipient.email,
      kind: "broadcast",
      locale: resolveLocale(recipient.locale),
      vars: {
        subject: broadcast.subject,
        body: broadcast.body,
        optOutUrl,
      },
    });

    const delivered = outcome.status === "sent";
    if (delivered) {
      sent += 1;
    } else {
      failed += 1;
    }

    // Alasan gagal wajib non-kosong bila status failed (Req 10.2).
    const failReason = delivered
      ? null
      : outcome.reason ?? outcome.status ?? "Unknown delivery failure";

    // Catat/menperbarui status penerima (idempoten via unique broadcastId+userId).
    await db.broadcastRecipient.upsert({
      where: {
        broadcastId_userId: { broadcastId: broadcast.id, userId: recipient.id },
      },
      create: {
        broadcastId: broadcast.id,
        userId: recipient.id,
        email: recipient.email,
        status: delivered ? "sent" : "failed",
        failReason,
        sentAt: delivered ? now : null,
      },
      update: {
        email: recipient.email,
        status: delivered ? "sent" : "failed",
        failReason,
        sentAt: delivered ? now : null,
      },
    });
  }

  const total = recipients.length;

  // Req 10.3: perbarui ringkasan tally broadcast + tandai selesai.
  await db.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status: "sent",
      totalCount: total,
      sentCount: sent,
      failedCount: failed,
      sentAt: now,
    },
  });

  return { ok: true, summary: { total, sent, failed } };
}

/**
 * Menetapkan status opt-out marketing user berdasarkan token opt-out mentah.
 *
 * Req 9.4: user yang mengakses tautan opt-out di-set `marketingOptOut = true`.
 * Mengembalikan `{ ok: false }` bila token tidak ditemukan.
 */
export async function optOut(rawOptOutToken: string): Promise<{ ok: boolean }> {
  return setMarketingOptOut(rawOptOutToken, true);
}

/**
 * Menghapus status opt-out marketing user berdasarkan token opt-out mentah.
 *
 * Req 9.5: user yang mengakses tautan berlangganan kembali di-set
 * `marketingOptOut = false`. Mengembalikan `{ ok: false }` bila token tidak ditemukan.
 */
export async function resubscribe(
  rawOptOutToken: string,
): Promise<{ ok: boolean }> {
  return setMarketingOptOut(rawOptOutToken, false);
}

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

interface RecipientRow {
  id: string;
  email: string;
  locale: string;
  optOutToken: string | null;
}

/**
 * Menyelesaikan himpunan penerima dari definisi segmen, mengecualikan user
 * berstatus opt-out (Req 9.1, 9.2).
 *
 *   - `all`    → seluruh user non-opt-out.
 *   - `subset` → irisan `userIds` (dari `segmentData` JSON) dengan user valid,
 *                non-opt-out. Array kosong/JSON tak valid → tidak ada penerima.
 */
async function resolveRecipients(
  segmentType: string,
  segmentData: string,
): Promise<RecipientRow[]> {
  const select = {
    id: true,
    email: true,
    locale: true,
    optOutToken: true,
  } as const;

  if (segmentType === "subset") {
    const userIds = parseUserIds(segmentData);
    if (userIds.length === 0) {
      return [];
    }
    return db.user.findMany({
      where: { id: { in: userIds }, marketingOptOut: false },
      select,
    });
  }

  // Default (termasuk "all"): seluruh user non-opt-out.
  return db.user.findMany({
    where: { marketingOptOut: false },
    select,
  });
}

/** Parse `segmentData` JSON menjadi array string userIds secara defensif. */
function parseUserIds(segmentData: string): string[] {
  if (!segmentData) return [];
  try {
    const parsed = JSON.parse(segmentData);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Memastikan user memiliki `optOutToken` stabil. Jika sudah ada, dipakai apa
 * adanya; jika null, buat token baru (UUID) lalu persist agar tautan opt-out
 * konsisten lintas pengiriman.
 */
async function ensureOptOutToken(
  userId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  const token = randomUUID();
  await db.user.update({
    where: { id: userId },
    data: { optOutToken: token },
  });
  return token;
}

/**
 * Set/hapus `marketingOptOut` berdasarkan token opt-out. Mengembalikan
 * `{ ok: false }` bila tidak ada user dengan token tersebut.
 */
async function setMarketingOptOut(
  rawOptOutToken: string,
  optedOut: boolean,
): Promise<{ ok: boolean }> {
  if (!rawOptOutToken) {
    return { ok: false };
  }

  const user = await db.user.findUnique({
    where: { optOutToken: rawOptOutToken },
    select: { id: true },
  });

  if (!user) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: user.id },
    data: { marketingOptOut: optedOut },
  });

  return { ok: true };
}
