ALTER TABLE "Asset" ADD COLUMN "roomBatchId" TEXT;
CREATE INDEX "Asset_roomId_roomBatchId_idx" ON "Asset"("roomId", "roomBatchId");
