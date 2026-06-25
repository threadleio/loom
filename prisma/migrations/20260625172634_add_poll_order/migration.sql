-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Poll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'multiple_choice',
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "correctAnswer" TEXT,
    "timerSeconds" INTEGER NOT NULL DEFAULT 30,
    "activatedAt" DATETIME,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Poll_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Poll" ("activatedAt", "correctAnswer", "createdAt", "id", "imageUrl", "roomId", "status", "timerSeconds", "title", "type") SELECT "activatedAt", "correctAnswer", "createdAt", "id", "imageUrl", "roomId", "status", "timerSeconds", "title", "type" FROM "Poll";
DROP TABLE "Poll";
ALTER TABLE "new_Poll" RENAME TO "Poll";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
