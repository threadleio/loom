-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "accessCode" TEXT NOT NULL,
    "passcode" TEXT,
    "moderationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "endedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("accessCode", "createdAt", "createdBy", "endDate", "endedAt", "id", "moderationEnabled", "name", "passcode", "startDate", "status") SELECT "accessCode", "createdAt", "createdBy", "endDate", "endedAt", "id", "moderationEnabled", "name", "passcode", "startDate", "status" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
