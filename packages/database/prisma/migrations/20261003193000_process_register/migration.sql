CREATE TABLE "ProcessRegister" (
  "id" TEXT NOT NULL,
  "owner" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "health" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "sharepointUrl" TEXT NOT NULL DEFAULT '',
  "methodologyUrl" TEXT NOT NULL DEFAULT '',
  "nextAction" TEXT NOT NULL DEFAULT '',
  "nextReviewOn" TEXT NOT NULL DEFAULT '',
  "target" TEXT NOT NULL DEFAULT '',
  "measurement" TEXT NOT NULL DEFAULT '',
  "problem" TEXT NOT NULL DEFAULT '',
  "countermeasure" TEXT NOT NULL DEFAULT '',
  "verification" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessRegister_pkey" PRIMARY KEY ("id")
);
