-- CreateTable
CREATE TABLE "UserRateLimit" (
    "userId" TEXT NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 60,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRateLimit_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SystemThresholdConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemThresholdConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "UserRateLimit_requestsPerMinute_idx" ON "UserRateLimit"("requestsPerMinute");

-- AddForeignKey
ALTER TABLE "UserRateLimit" ADD CONSTRAINT "UserRateLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
