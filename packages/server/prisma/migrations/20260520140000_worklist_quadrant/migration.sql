-- AlterTable
ALTER TABLE "WorklistItem" ADD COLUMN "quadrant" TEXT NOT NULL DEFAULT 'q2';

UPDATE "WorklistItem" SET "quadrant" = 'q2' WHERE "quadrant" = '' OR "quadrant" IS NULL;
