CREATE TABLE "TeamleaderConnection" (
 "companyCode" TEXT NOT NULL PRIMARY KEY,
 "mode" TEXT NOT NULL,
 "accessToken" TEXT,
 "refreshToken" TEXT,
 "expiresAt" TIMESTAMP(3),
 "stateHash" TEXT,
 "stateActorId" TEXT,
 "stateExpiresAt" TIMESTAMP(3),
 "connectedAt" TIMESTAMP(3),
 "nextSyncAt" TIMESTAMP(3),
 "lastAttemptAt" TIMESTAMP(3),
 "lastSuccessAt" TIMESTAMP(3),
 "lastError" TEXT,
 "projectCount" INTEGER NOT NULL DEFAULT 0,
 "leaseId" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "TeamleaderConnection_stateHash_key" ON "TeamleaderConnection"("stateHash");
CREATE TABLE "TeamleaderSyncRun" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyCode" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL,
 "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "projectCount" INTEGER,
 "error" TEXT
);
CREATE INDEX "TeamleaderSyncRun_companyCode_finishedAt_idx" ON "TeamleaderSyncRun"("companyCode", "finishedAt");
