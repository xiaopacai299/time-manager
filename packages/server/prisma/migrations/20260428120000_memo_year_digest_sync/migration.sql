-- CreateTable
CREATE TABLE "MemoItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "reminderNotified" BOOLEAN NOT NULL DEFAULT false,
    "clientDeviceId" TEXT NOT NULL,

    CONSTRAINT "MemoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkYearDigest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "clientDeviceId" TEXT NOT NULL,

    CONSTRAINT "WorkYearDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoItem_userId_updatedAt_idx" ON "MemoItem"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkYearDigest_userId_updatedAt_idx" ON "WorkYearDigest"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkYearDigest_userId_year_key" ON "WorkYearDigest"("userId", "year");

-- AddForeignKey
ALTER TABLE "MemoItem" ADD CONSTRAINT "MemoItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkYearDigest" ADD CONSTRAINT "WorkYearDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
