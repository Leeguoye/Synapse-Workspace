-- CreateTable
CREATE TABLE "DriveFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "parentId" TEXT,
    "size" TEXT,
    "iconLink" TEXT,
    "webViewLink" TEXT,
    "thumbnailLink" TEXT,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "trashed" BOOLEAN NOT NULL DEFAULT false,
    "ownedByMe" BOOLEAN NOT NULL DEFAULT true,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "ownerName" TEXT,
    "ownerPhoto" TEXT,
    "sharedWithMeTime" DATETIME,
    "createdTime" DATETIME,
    "modifiedTime" DATETIME,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "DriveFile_parentId_idx" ON "DriveFile"("parentId");

-- CreateIndex
CREATE INDEX "DriveFile_mimeType_idx" ON "DriveFile"("mimeType");

-- CreateIndex
CREATE INDEX "DriveFile_trashed_idx" ON "DriveFile"("trashed");

-- CreateIndex
CREATE INDEX "DriveFile_starred_idx" ON "DriveFile"("starred");

-- CreateIndex
CREATE INDEX "DriveFile_sharedWithMeTime_idx" ON "DriveFile"("sharedWithMeTime");
