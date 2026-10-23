ALTER TABLE "Project" ADD COLUMN "sourceExtraFields" JSONB;
CREATE TABLE "QboxReaderConfig" (
  "companyCode" TEXT NOT NULL PRIMARY KEY,
  "selectedColumns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "revision" INTEGER NOT NULL DEFAULT 0,
  "appliedRevision" INTEGER,
  "schemaColumns" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "schemaReportedAt" TIMESTAMP(3),
  "readerVersion" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
