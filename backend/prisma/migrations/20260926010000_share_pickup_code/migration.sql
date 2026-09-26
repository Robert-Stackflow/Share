ALTER TABLE "Share" ADD COLUMN "pickupCode" TEXT;
CREATE UNIQUE INDEX "Share_pickupCode_key" ON "Share"("pickupCode");
