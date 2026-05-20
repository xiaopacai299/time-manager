-- AlterTable
ALTER TABLE "WorklistItem" ADD COLUMN "listDate" TEXT NOT NULL DEFAULT '';

UPDATE "WorklistItem"
SET "listDate" = to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "listDate" = '';

CREATE INDEX "WorklistItem_userId_listDate_idx" ON "WorklistItem"("userId", "listDate");
