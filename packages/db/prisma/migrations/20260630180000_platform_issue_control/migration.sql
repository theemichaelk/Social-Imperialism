-- THEE_MICHAEL Issue Control Plane — active queue + historical ledger
CREATE TABLE "PlatformIssue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "issueSignature" TEXT NOT NULL,
    "filePath" TEXT,
    "component" TEXT,
    "platform" TEXT,
    "errorCode" TEXT,
    "traceback" TEXT NOT NULL,
    "rootCause" TEXT,
    "patchDiff" TEXT,
    "patchCode" TEXT,
    "webSources" TEXT,
    "nodeId" TEXT,
    "dependencies" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformIssueLedger" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueId" TEXT,
    "action" TEXT NOT NULL,
    "issueSignature" TEXT NOT NULL,
    "traceback" TEXT NOT NULL,
    "patchCode" TEXT,
    "outcome" TEXT,
    "deploymentMetrics" TEXT,
    "actedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformIssueLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformIssue_projectId_status_idx" ON "PlatformIssue"("projectId", "status");
CREATE INDEX "PlatformIssue_issueSignature_idx" ON "PlatformIssue"("issueSignature");
CREATE INDEX "PlatformIssueLedger_projectId_createdAt_idx" ON "PlatformIssueLedger"("projectId", "createdAt");

ALTER TABLE "PlatformIssue" ADD CONSTRAINT "PlatformIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformIssueLedger" ADD CONSTRAINT "PlatformIssueLedger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;