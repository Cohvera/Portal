ALTER TABLE "Project" ADD COLUMN "sourceStatusCode" TEXT, ADD COLUMN "sourceDates" JSONB;
CREATE TABLE "ProjectSourceEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "observedAt" TIMESTAMP(3) NOT NULL,
 "message" TEXT NOT NULL
);
CREATE INDEX "ProjectSourceEvent_projectId_observedAt_idx" ON "ProjectSourceEvent"("projectId", "observedAt");
CREATE INDEX "ProjectSourceEvent_observedAt_idx" ON "ProjectSourceEvent"("observedAt");
