CREATE TABLE "StorageMultipartUpload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "objectKey" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "parts" TEXT NOT NULL DEFAULT '[]',
  "expectedParts" INTEGER NOT NULL
);

CREATE INDEX "StorageMultipartUpload_updatedAt_idx" ON "StorageMultipartUpload"("updatedAt");
