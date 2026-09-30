INSERT INTO "Permission" ("id", "key", "description") VALUES ('projects-create', 'projects.create', 'Projecten aanmaken binnen het eigen bedrijf') ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key IN ('employee','manager','company-admin','portal-admin') AND p.key='projects.create'
ON CONFLICT DO NOTHING;
