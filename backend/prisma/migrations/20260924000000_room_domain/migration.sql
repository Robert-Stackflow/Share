-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "roomId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'SHARED',
    "name" TEXT,
    "passcodeHash" TEXT,
    "ownerId" TEXT,
    CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Keep database IDs and public room IDs unchanged. Former private clipboard
-- rows become private rooms, retaining their assets and owners.
INSERT INTO "Room" ("id", "createdAt", "updatedAt", "roomId", "visibility", "name", "passcodeHash", "ownerId")
SELECT "id", "createdAt", "updatedAt", COALESCE("roomId", "id"),
       CASE WHEN "type" = 'PRIVATE' THEN 'PRIVATE' ELSE 'SHARED' END,
       "name", "passcodeHash", "ownerId"
FROM "Clipboard";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "ownerId" TEXT,
    "shareId" TEXT,
    "roomId" TEXT,
    "inboxSubmissionId" TEXT,
    "name" TEXT,
    "size" TEXT,
    "mimeType" TEXT,
    "storage" TEXT,
    "content" TEXT,
    "url" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "lastAccessedAt" DATETIME,
    CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_inboxSubmissionId_fkey" FOREIGN KEY ("inboxSubmissionId") REFERENCES "InboxSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("content", "createdAt", "favorite", "id", "inboxSubmissionId", "lastAccessedAt", "mimeType", "name", "ownerId", "roomId", "shareId", "size", "source", "storage", "type", "url")
SELECT "content", "createdAt", "favorite", "id", "inboxSubmissionId", "lastAccessedAt", "mimeType", "name", "ownerId",
       "clipboardId", "shareId", "size", "source", "storage", "type", "url"
FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");
CREATE INDEX "Asset_shareId_idx" ON "Asset"("shareId");
CREATE INDEX "Asset_roomId_idx" ON "Asset"("roomId");
CREATE INDEX "Asset_inboxSubmissionId_idx" ON "Asset"("inboxSubmissionId");
CREATE INDEX "Asset_source_idx" ON "Asset"("source");
CREATE INDEX "Asset_favorite_idx" ON "Asset"("favorite");
CREATE INDEX "Asset_lastAccessedAt_idx" ON "Asset"("lastAccessedAt");
DROP TABLE "Clipboard";
CREATE TABLE "new_AccessPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" DATETIME,
    "maxViews" INTEGER,
    "views" INTEGER NOT NULL DEFAULT 0,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "oneTime" BOOLEAN NOT NULL DEFAULT false,
    "shareId" TEXT,
    "roomId" TEXT,
    "shortLinkId" TEXT,
    "reverseShareId" TEXT,
    CONSTRAINT "AccessPolicy_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AccessPolicy" ("allowAnonymous", "allowDownload", "createdAt", "expiresAt", "id", "maxViews", "oneTime", "passwordHash", "reverseShareId", "roomId", "shareId", "shortLinkId", "updatedAt", "views")
SELECT "allowAnonymous", "allowDownload", "createdAt", "expiresAt", "id", "maxViews", "oneTime", "passwordHash", "reverseShareId",
       CASE WHEN "clipboardId" IN (SELECT "id" FROM "Room") THEN "clipboardId" ELSE NULL END,
       "shareId", "shortLinkId", "updatedAt", "views" FROM "AccessPolicy";
DROP TABLE "AccessPolicy";
ALTER TABLE "new_AccessPolicy" RENAME TO "AccessPolicy";
CREATE UNIQUE INDEX "AccessPolicy_shareId_key" ON "AccessPolicy"("shareId");
CREATE UNIQUE INDEX "AccessPolicy_roomId_key" ON "AccessPolicy"("roomId");
CREATE UNIQUE INDEX "AccessPolicy_shortLinkId_key" ON "AccessPolicy"("shortLinkId");
CREATE UNIQUE INDEX "AccessPolicy_reverseShareId_key" ON "AccessPolicy"("reverseShareId");
CREATE INDEX "AccessPolicy_expiresAt_idx" ON "AccessPolicy"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");
