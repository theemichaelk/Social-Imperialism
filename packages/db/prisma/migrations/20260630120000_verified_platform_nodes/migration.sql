-- CreateTable
CREATE TABLE "VerifiedPlatformNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "socialAccountId" TEXT,
    "connectionId" TEXT,
    "parentNodeId" TEXT,
    "platform" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "entityData" TEXT,
    "privacyState" TEXT,
    "memberCount" INTEGER,
    "verificationState" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "strikeCount" INTEGER NOT NULL DEFAULT 0,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestSuccessAt" TIMESTAMP(3),
    "lastTierPassed" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "proxyProfile" TEXT,
    "userAgentProfile" TEXT,
    "continuousMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerifiedPlatformNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRun" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "tierName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "httpStatus" INTEGER,
    "responseMeta" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "livePostId" TEXT,
    "purged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeRepairAttempt" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "strike" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "proxyRotated" BOOLEAN NOT NULL DEFAULT false,
    "sessionRefreshed" BOOLEAN NOT NULL DEFAULT false,
    "errorLog" TEXT,
    "webhookSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NodeRepairAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "targetUrl" TEXT NOT NULL DEFAULT 'https://socialimperialism.com',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "frequencyCron" TEXT,
    "burstIntervalM" INTEGER,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignNodeBinding" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignNodeBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtmPublishEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "nodeId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "fullUrl" TEXT NOT NULL,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtmPublishEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "ScheduledPost" ADD COLUMN "verifiedNodeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedPlatformNode_projectId_platform_externalId_key" ON "VerifiedPlatformNode"("projectId", "platform", "externalId");
CREATE INDEX "VerifiedPlatformNode_projectId_verificationState_idx" ON "VerifiedPlatformNode"("projectId", "verificationState");
CREATE INDEX "VerifiedPlatformNode_connectionId_idx" ON "VerifiedPlatformNode"("connectionId");
CREATE INDEX "VerifiedPlatformNode_parentNodeId_idx" ON "VerifiedPlatformNode"("parentNodeId");

CREATE INDEX "VerificationRun_nodeId_tier_idx" ON "VerificationRun"("nodeId", "tier");
CREATE INDEX "VerificationRun_createdAt_idx" ON "VerificationRun"("createdAt");

CREATE INDEX "NodeRepairAttempt_nodeId_strike_idx" ON "NodeRepairAttempt"("nodeId", "strike");

CREATE INDEX "Campaign_projectId_status_idx" ON "Campaign"("projectId", "status");

CREATE UNIQUE INDEX "CampaignNodeBinding_campaignId_nodeId_key" ON "CampaignNodeBinding"("campaignId", "nodeId");

CREATE INDEX "UtmPublishEvent_nodeId_idx" ON "UtmPublishEvent"("nodeId");
CREATE INDEX "UtmPublishEvent_campaignId_idx" ON "UtmPublishEvent"("campaignId");

CREATE INDEX "ScheduledPost_campaignId_status_idx" ON "ScheduledPost"("campaignId", "status");
CREATE INDEX "ScheduledPost_verifiedNodeId_idx" ON "ScheduledPost"("verifiedNodeId");

-- AddForeignKey
ALTER TABLE "VerifiedPlatformNode" ADD CONSTRAINT "VerifiedPlatformNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifiedPlatformNode" ADD CONSTRAINT "VerifiedPlatformNode_parentNodeId_fkey" FOREIGN KEY ("parentNodeId") REFERENCES "VerifiedPlatformNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedPlatformNode" ADD CONSTRAINT "VerifiedPlatformNode_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VerificationRun" ADD CONSTRAINT "VerificationRun_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "VerifiedPlatformNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NodeRepairAttempt" ADD CONSTRAINT "NodeRepairAttempt_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "VerifiedPlatformNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignNodeBinding" ADD CONSTRAINT "CampaignNodeBinding_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignNodeBinding" ADD CONSTRAINT "CampaignNodeBinding_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "VerifiedPlatformNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UtmPublishEvent" ADD CONSTRAINT "UtmPublishEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UtmPublishEvent" ADD CONSTRAINT "UtmPublishEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "VerifiedPlatformNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;