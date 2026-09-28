ALTER TABLE "User" ADD COLUMN "entraTenantId" TEXT;
DROP INDEX IF EXISTS "User_entraObjectId_key";
CREATE UNIQUE INDEX "User_entraTenantId_entraObjectId_key" ON "User"("entraTenantId", "entraObjectId");
CREATE TABLE "PortalSession" (
 "tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "roles" TEXT[] NOT NULL, "tenantId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");
CREATE TABLE "EntraLoginAttempt" (
 "tokenHash" TEXT PRIMARY KEY, "state" TEXT NOT NULL, "nonce" TEXT NOT NULL,
 "verifier" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "EntraLoginAttempt_expiresAt_idx" ON "EntraLoginAttempt"("expiresAt");
-- Business rights never grant an Entra Portal.Admin role.
INSERT INTO "Role" ("id","key","name","description")
VALUES ('company-admin','company-admin','Bedrijfsbeheerder','Beheert werkzaamheden binnen toegewezen bedrijven; geen portaalbeheer.')
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key='company-admin' AND p.key NOT IN ('portal.admin','users.manage','plugins.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE (r.key IN ('manager','employee') AND p.key IN ('inspections.read','inspections.write'))
   OR (r.key='viewer' AND p.key='inspections.read')
ON CONFLICT DO NOTHING;
