ALTER TABLE "QboxImport" ADD COLUMN "contractVersion" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Project" ADD COLUMN "sourceStatusLabel" TEXT,
  ADD COLUMN "sourceIsClosed" BOOLEAN,
  ADD COLUMN "sourceIsActive" BOOLEAN,
  ADD COLUMN "sourceRecordId" TEXT;
