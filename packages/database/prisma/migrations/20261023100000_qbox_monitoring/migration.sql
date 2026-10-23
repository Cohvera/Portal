CREATE TABLE "QboxReaderEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyCode" TEXT NOT NULL,
 "runId" TEXT NOT NULL,
 "phase" TEXT NOT NULL,
 "observedAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "readerVersion" TEXT NOT NULL,
 "recordCount" INTEGER,
 "httpStatus" INTEGER
);
CREATE UNIQUE INDEX "QboxReaderEvent_companyCode_runId_phase_key" ON "QboxReaderEvent"("companyCode", "runId", "phase");
CREATE INDEX "QboxReaderEvent_companyCode_observedAt_idx" ON "QboxReaderEvent"("companyCode", "observedAt");
CREATE INDEX "QboxReaderEvent_companyCode_receivedAt_idx" ON "QboxReaderEvent"("companyCode", "receivedAt");
