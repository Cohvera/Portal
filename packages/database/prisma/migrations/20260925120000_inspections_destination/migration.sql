-- Use the original Keuringen tool instead of a duplicate shortcut.
-- Preserve explicit company assignments on either existing entry.
INSERT INTO "ToolCatalog" ("id", "kind", "companyCodes", "updatedAt")
SELECT 'inspections', 'builtin', "companyCodes", CURRENT_TIMESTAMP
FROM "ToolCatalog"
WHERE "id" = 'tomme-keuringen'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ToolCatalog" ("id", "kind", "companyCodes", "updatedAt")
VALUES ('inspections', 'builtin', ARRAY['TOMME'], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "ToolCatalog"
WHERE "id" = 'tomme-keuringen'
  AND "href" = 'https://www.tomme-energie.lan/keuringen/';
