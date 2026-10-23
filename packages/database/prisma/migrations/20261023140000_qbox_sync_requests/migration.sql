ALTER TABLE "QboxReaderConfig"
ADD COLUMN "syncRequestId" TEXT,
ADD COLUMN "syncAcknowledgedId" TEXT,
ADD COLUMN "syncRequestedAt" TIMESTAMP(3),
ADD COLUMN "commandPollAt" TIMESTAMP(3);
