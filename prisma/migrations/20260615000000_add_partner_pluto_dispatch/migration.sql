-- Additive migration untuk integrasi Partner Platform (Pluto) — Private Beta.
-- Hanya menambah kolom/tabel/index baru. TIDAK mengubah/menghapus kolom, tabel, atau
-- migration history existing. Aman dijalankan ulang (idempotent) mengikuti konvensi
-- migration additive sebelumnya. Main DB tetap pemilik buyer, saldo, order, debit, refund.
-- Tidak ada foreign key atau referensi ke database Partner (kirimkode_partner).

-- AlterTable: referensi opaque ke Partner Platform pada orders (nullable, non-breaking).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "providerOrderRef" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "providerRequestRef" TEXT;

-- CreateIndex: percepat rekonsiliasi berdasarkan referensi order Partner.
CREATE INDEX IF NOT EXISTS "orders_providerOrderRef_idx" ON "orders"("providerOrderRef");

-- CreateTable: tabel operasi/kompensasi saga debit-reserve-confirm-compensate.
CREATE TABLE IF NOT EXISTS "partner_dispatches" (
    "id" TEXT NOT NULL,
    "purchaseKey" TEXT NOT NULL,
    "reserveKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "orderId" TEXT,
    "buyerOrderRef" TEXT,
    "buyerAccountRef" TEXT,
    "providerOrderRef" TEXT,
    "providerRequestRef" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "debitApplied" BOOLEAN NOT NULL DEFAULT false,
    "refundApplied" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique purchase key menjamin exactly-once debit/reserve/kompensasi.
CREATE UNIQUE INDEX IF NOT EXISTS "partner_dispatches_purchaseKey_key" ON "partner_dispatches"("purchaseKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_status_idx" ON "partner_dispatches"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_userId_idx" ON "partner_dispatches"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_orderId_idx" ON "partner_dispatches"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_reserveKey_idx" ON "partner_dispatches"("reserveKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_providerOrderRef_idx" ON "partner_dispatches"("providerOrderRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_dispatches_createdAt_idx" ON "partner_dispatches"("createdAt");
