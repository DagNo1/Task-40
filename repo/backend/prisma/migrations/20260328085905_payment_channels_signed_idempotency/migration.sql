-- CreateTable
CREATE TABLE "PaymentChannelRequest" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "systemIdentity" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "requestTimestamp" TIMESTAMP(3) NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "duplicateDetected" BOOLEAN NOT NULL DEFAULT false,
    "replayDetected" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentChannelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentChannelRequest_channel_nonce_idx" ON "PaymentChannelRequest"("channel", "nonce");

-- CreateIndex
CREATE INDEX "PaymentChannelRequest_createdAt_idx" ON "PaymentChannelRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentChannelRequest_channel_idempotencyKey_key" ON "PaymentChannelRequest"("channel", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PaymentChannelRequest" ADD CONSTRAINT "PaymentChannelRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
