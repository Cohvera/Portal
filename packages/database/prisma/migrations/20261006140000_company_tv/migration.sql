CREATE TABLE "TvBoard" (
  "companyCode" TEXT PRIMARY KEY REFERENCES "Company"("code") ON DELETE CASCADE ON UPDATE CASCADE,
  "settings" JSONB NOT NULL DEFAULT '{}',
  "fleet" JSONB,
  "nas" JSONB,
  "receivedAt" TIMESTAMP(3)
);
