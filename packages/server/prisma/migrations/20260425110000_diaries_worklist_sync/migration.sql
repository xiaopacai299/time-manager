-- Convert diary sync storage from encrypted placeholders to plaintext Phase 1 fields.
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "content" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DiaryEntry" ALTER COLUMN "titleCipher" SET DEFAULT '';
ALTER TABLE "DiaryEntry" ALTER COLUMN "contentCipher" SET DEFAULT '';
ALTER TABLE "DiaryEntry" ALTER COLUMN "nonce" SET DEFAULT '';

-- CreateTable
CREATE TABLE "WorklistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "reminderAt" TIMESTAMP(3),
    "estimateDoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "reminderNotified" BOOLEAN NOT NULL DEFAULT false,
    "completionResult" TEXT NOT NULL DEFAULT '',
    "confirmSnoozeUntil" TIMESTAMP(3),
    "clientDeviceId" TEXT NOT NULL,

    CONSTRAINT "WorklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorklistItem_userId_updatedAt_idx" ON "WorklistItem"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "WorklistItem" ADD CONSTRAINT "WorklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
