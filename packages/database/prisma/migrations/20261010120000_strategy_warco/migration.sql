CREATE TABLE "StrategyAction" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "roadmap" TEXT NOT NULL,
  "actionCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "ownerId" TEXT,
  "dueOn" TEXT NOT NULL DEFAULT '',
  "nextStep" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StrategyAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StrategyAction_status_check" CHECK ("status" IN ('REVIEW','PLANNED','ACTIVE','BLOCKED','DONE'))
);
CREATE UNIQUE INDEX "StrategyAction_companyId_roadmap_actionCode_key" ON "StrategyAction"("companyId", "roadmap", "actionCode");
CREATE INDEX "StrategyAction_companyId_status_idx" ON "StrategyAction"("companyId", "status");
ALTER TABLE "StrategyAction" ADD CONSTRAINT "StrategyAction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategyAction" ADD CONSTRAINT "StrategyAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
