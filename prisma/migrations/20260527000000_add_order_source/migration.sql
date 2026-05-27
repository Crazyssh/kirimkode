-- AlterTable: tambah kolom source (web | api) ke orders
ALTER TABLE "orders" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'web';
