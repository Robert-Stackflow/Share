CREATE TABLE "AppCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "tokenHint" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "expiresAt" DATETIME,
  "lastUsedAt" DATETIME,
  "revokedAt" DATETIME,
  "userId" TEXT NOT NULL,
  CONSTRAINT "AppCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AppCredential_userId_createdAt_idx" ON "AppCredential"("userId", "createdAt");
CREATE INDEX "AppCredential_expiresAt_idx" ON "AppCredential"("expiresAt");
CREATE INDEX "AppCredential_revokedAt_idx" ON "AppCredential"("revokedAt");
