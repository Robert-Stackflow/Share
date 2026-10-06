-- CreateTable
CREATE TABLE "ImageAlbum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "ImageAlbum_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HostedImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "slug" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" DATETIME,
    "assetId" TEXT NOT NULL,
    "albumId" TEXT,
    CONSTRAINT "HostedImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HostedImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "ImageAlbum" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HostedImage" ("assetId", "checksum", "createdAt", "height", "id", "slug", "updatedAt", "visibility", "width") SELECT "assetId", "checksum", "createdAt", "height", "id", "slug", "updatedAt", "visibility", "width" FROM "HostedImage";
DROP TABLE "HostedImage";
ALTER TABLE "new_HostedImage" RENAME TO "HostedImage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "ImageVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "hostedImageId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    CONSTRAINT "ImageVariant_hostedImageId_fkey" FOREIGN KEY ("hostedImageId") REFERENCES "HostedImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImageVariant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImagePreference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "autoOrient" BOOLEAN NOT NULL DEFAULT true,
    "stripMetadata" BOOLEAN NOT NULL DEFAULT true,
    "outputFormat" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "quality" INTEGER NOT NULL DEFAULT 82,
    "maxWidth" INTEGER,
    "deduplicate" BOOLEAN NOT NULL DEFAULT false,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "watermarkText" TEXT,
    "watermarkOpacity" INTEGER NOT NULL DEFAULT 30,
    "watermarkPosition" TEXT NOT NULL DEFAULT 'southeast',
    CONSTRAINT "ImagePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAlbum_ownerId_name_key" ON "ImageAlbum"("ownerId", "name");
CREATE INDEX "ImageAlbum_ownerId_updatedAt_idx" ON "ImageAlbum"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "HostedImage_slug_key" ON "HostedImage"("slug");
CREATE UNIQUE INDEX "HostedImage_assetId_key" ON "HostedImage"("assetId");
CREATE INDEX "HostedImage_createdAt_idx" ON "HostedImage"("createdAt");
CREATE INDEX "HostedImage_visibility_idx" ON "HostedImage"("visibility");
CREATE INDEX "HostedImage_checksum_idx" ON "HostedImage"("checksum");
CREATE INDEX "HostedImage_albumId_createdAt_idx" ON "HostedImage"("albumId", "createdAt");
CREATE INDEX "HostedImage_deletedAt_createdAt_idx" ON "HostedImage"("deletedAt", "createdAt");
CREATE UNIQUE INDEX "ImageVariant_assetId_key" ON "ImageVariant"("assetId");
CREATE UNIQUE INDEX "ImageVariant_hostedImageId_kind_key" ON "ImageVariant"("hostedImageId", "kind");
CREATE INDEX "ImageVariant_hostedImageId_idx" ON "ImageVariant"("hostedImageId");
