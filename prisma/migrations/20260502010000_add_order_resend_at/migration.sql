-- AlterTable
ALTER TABLE "orders" ADD COLUMN "resendAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_resendAt_idx" ON "orders"("resendAt");
