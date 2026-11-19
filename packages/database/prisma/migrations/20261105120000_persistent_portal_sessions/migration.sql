ALTER TABLE "PortalSession" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- Keep currently valid logins, without reviving already expired sessions.
UPDATE "PortalSession" SET "expiresAt" = NULL WHERE "expiresAt" > CURRENT_TIMESTAMP;
