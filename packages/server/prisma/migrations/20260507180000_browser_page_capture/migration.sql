-- CreateTable
CREATE TABLE "BrowserPageCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "pageSnippet" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserPageCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserPageCapture_userId_capturedAt_idx" ON "BrowserPageCapture"("userId", "capturedAt");

-- AddForeignKey
ALTER TABLE "BrowserPageCapture" ADD CONSTRAINT "BrowserPageCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
