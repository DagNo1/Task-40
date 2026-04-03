-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "latestTitle" TEXT NOT NULL,
    "latestBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryVersion" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rawUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "simhash" TEXT NOT NULL,
    "minhashSignature" TEXT NOT NULL,
    "duplicateFlag" BOOLEAN NOT NULL DEFAULT false,
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "duplicateExplanation" TEXT,
    "anomalyExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupCluster" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "similarityDetails" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DedupCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "groupedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DedupClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleansingEvent" (
    "id" TEXT NOT NULL,
    "storyVersionId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleansingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_canonicalUrl_idx" ON "Story"("canonicalUrl");

-- CreateIndex
CREATE INDEX "StoryVersion_canonicalUrl_idx" ON "StoryVersion"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "StoryVersion_storyId_versionNumber_key" ON "StoryVersion"("storyId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DedupCluster_key_key" ON "DedupCluster"("key");

-- CreateIndex
CREATE INDEX "DedupClusterMember_storyId_idx" ON "DedupClusterMember"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "DedupClusterMember_clusterId_storyId_key" ON "DedupClusterMember"("clusterId", "storyId");

-- CreateIndex
CREATE INDEX "CleansingEvent_createdAt_idx" ON "CleansingEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CleansingEvent_storyVersionId_idx" ON "CleansingEvent"("storyVersionId");

-- AddForeignKey
ALTER TABLE "StoryVersion" ADD CONSTRAINT "StoryVersion_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedupClusterMember" ADD CONSTRAINT "DedupClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "DedupCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DedupClusterMember" ADD CONSTRAINT "DedupClusterMember_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleansingEvent" ADD CONSTRAINT "CleansingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
