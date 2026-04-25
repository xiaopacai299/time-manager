-- Keep legacy encrypted diary columns available for installations that already
-- applied an earlier local migration draft which dropped them.
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "titleCipher" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "contentCipher" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "nonce" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiaryEntry" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1;
