-- CreateTable
CREATE TABLE "ExtensionUploadToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionUploadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionUploadToken_tokenHash_key" ON "ExtensionUploadToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ExtensionUploadToken_userId_idx" ON "ExtensionUploadToken"("userId");

-- AddForeignKey
ALTER TABLE "ExtensionUploadToken" ADD CONSTRAINT "ExtensionUploadToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
