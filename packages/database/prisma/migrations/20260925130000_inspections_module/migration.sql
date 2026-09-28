CREATE TABLE "Inspection" (
 "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
 "version" INTEGER NOT NULL DEFAULT 1, "data" JSONB NOT NULL, "previousId" TEXT UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Inspection_companyId_updatedAt_idx" ON "Inspection"("companyId", "updatedAt");
CREATE TABLE "InspectionDocument" (
 "id" TEXT PRIMARY KEY, "inspectionId" TEXT NOT NULL REFERENCES "Inspection"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "category" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL,
 "content" BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InspectionDocument_inspectionId_idx" ON "InspectionDocument"("inspectionId");
CREATE TABLE "InspectionEvent" (
 "id" TEXT PRIMARY KEY, "inspectionId" TEXT NOT NULL REFERENCES "Inspection"("id") ON DELETE CASCADE,
 "actor" TEXT NOT NULL, "action" TEXT NOT NULL, "detail" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InspectionEvent_inspectionId_createdAt_idx" ON "InspectionEvent"("inspectionId", "createdAt");
INSERT INTO "ToolCatalog" ("id", "kind", "name", "description", "href", "companyCodes", "updatedAt")
VALUES ('tomme-keuringen', 'tool', 'Tomme Keuringen · bestaand portaal', 'De bestaande Tomme-toepassing met de huidige dossiers en documenten. Blijft afzonderlijk beschikbaar via bedrijfsnetwerk of VPN.', 'https://www.tomme-energie.lan/keuringen/', ARRAY['TOMME'], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
