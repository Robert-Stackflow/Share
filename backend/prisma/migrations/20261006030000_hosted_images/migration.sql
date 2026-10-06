-- CreateTable
CREATE TABLE "HostedImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "slug" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "HostedImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HostedImage_slug_key" ON "HostedImage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HostedImage_assetId_key" ON "HostedImage"("assetId");

-- CreateIndex
CREATE INDEX "HostedImage_createdAt_idx" ON "HostedImage"("createdAt");

-- CreateIndex
CREATE INDEX "HostedImage_visibility_idx" ON "HostedImage"("visibility");

-- CreateIndex
CREATE INDEX "HostedImage_checksum_idx" ON "HostedImage"("checksum");
