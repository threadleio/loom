-- DropIndex
DROP INDEX "PollResponse_pollId_userId_key";

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN "activatedAt" DATETIME;

-- CreateIndex
CREATE INDEX "PollResponse_pollId_userId_idx" ON "PollResponse"("pollId", "userId");
