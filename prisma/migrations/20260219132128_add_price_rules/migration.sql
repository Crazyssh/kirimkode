-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceCode" TEXT NOT NULL,
    "countryId" INTEGER NOT NULL DEFAULT 0,
    "priceType" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "price_rules_serviceCode_countryId_key" ON "price_rules"("serviceCode", "countryId");
