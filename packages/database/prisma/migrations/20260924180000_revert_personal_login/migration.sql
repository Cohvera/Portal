-- Undo personal authentication without removing users, memberships or business records.
DROP TABLE IF EXISTS "AuthSession";
DROP TABLE IF EXISTS "PasswordSetupToken";
DROP TABLE IF EXISTS "LoginThrottle";
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
