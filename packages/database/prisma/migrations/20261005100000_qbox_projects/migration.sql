ALTER TABLE "Project" ADD COLUMN "externalSource" TEXT, ADD COLUMN "externalId" TEXT,
  ADD COLUMN "sourceDescription" TEXT, ADD COLUMN "sourcePlannedAt" DATE, ADD COLUMN "sourceSeenAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Project_companyId_externalSource_externalId_key" ON "Project"("companyId", "externalSource", "externalId");
CREATE TABLE "QboxImport" (
  "companyCode" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "sourceObservedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectCount" INTEGER NOT NULL
);
