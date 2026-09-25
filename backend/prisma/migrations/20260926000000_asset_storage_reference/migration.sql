ALTER TABLE "Asset" ADD COLUMN "storageKey" TEXT;
CREATE INDEX "Asset_storageKey_idx" ON "Asset"("storageKey");
