-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "bundleCount" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "statusExplanation" TEXT NOT NULL,
    "storyVersionId" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundCase" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "storyVersionId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreezeCase" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "frozenByUserId" TEXT,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "releaseNote" TEXT,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "FreezeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundLedger" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "netAmountCents" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reference_key" ON "Transaction"("reference");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_storyVersionId_idx" ON "Transaction"("storyVersionId");

-- CreateIndex
CREATE INDEX "RefundCase_transactionId_idx" ON "RefundCase"("transactionId");

-- CreateIndex
CREATE INDEX "RefundCase_storyVersionId_idx" ON "RefundCase"("storyVersionId");

-- CreateIndex
CREATE INDEX "FreezeCase_transactionId_idx" ON "FreezeCase"("transactionId");

-- CreateIndex
CREATE INDEX "FreezeCase_status_idx" ON "FreezeCase"("status");

-- CreateIndex
CREATE INDEX "FundLedger_transactionId_createdAt_idx" ON "FundLedger"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_storyVersionId_fkey" FOREIGN KEY ("storyVersionId") REFERENCES "StoryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundCase" ADD CONSTRAINT "RefundCase_storyVersionId_fkey" FOREIGN KEY ("storyVersionId") REFERENCES "StoryVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreezeCase" ADD CONSTRAINT "FreezeCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundLedger" ADD CONSTRAINT "FundLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
