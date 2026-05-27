-- AlterTable: tambah kolom source (web | api | bot) ke orders.
-- Idempotent — aman dijalankan ulang kalau kolom sudah ada (mis. dari prisma db push sebelumnya).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web';
