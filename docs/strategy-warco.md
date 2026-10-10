# Strategy Hub — Warco Roadmap

Route: `/hubs/strategy/warco`, linked from the existing Strategy Hub.
Uses the shared PortalShell, Entra session, business permissions and PostgreSQL.

## Deployment

Apply the new Prisma migration with the existing deployment procedure, generate
the Prisma client, and run `pnpm db:seed` to register `strategy.read` and
`strategy.manage`. Rebuild/restart API and web after migration. No new secrets,
service or database are needed. The migration only creates a table and indexes;
it does not replace existing data or seed fictional progress.

Access requires membership of active company `WARCO` and the relevant business
permission. Existing company business administrators retain their existing
bypass semantics. The portal-admin seed role receives the permissions like
other permissions; ordinary viewer/employee/manager roles are NOT expanded.
Assign the appropriate business role through existing access administration.
An Entra Portal.Admin role alone does not grant Warco business access.

## Data and API

- `GET /companies/WARCO/strategy/warco`: 29 actions, eligible active Warco
  users and the last 30 audit entries (actor, action ID, date).
- `PATCH /companies/WARCO/strategy/warco/actions/:id`: status, ownerId,
  dueOn (`YYYY-MM-DD` or empty), nextStep, notes and version.
- The global guard handles authentication, company permission and CSRF.
  The controller additionally checks membership and validates Warco scope.
- Initial unassessed actions use version 0. First save creates version 1.
  Subsequent saves require the current version. Duplicate first writes and
  stale updates return 409, leaving the user's draft visible.
- Data and before/after AuditLog entries commit in the same transaction.
- Source action IDs stay stable. Definitions are server-only, not bundled
  into the public web assets. Source: Operationeel Plan - Roadmap 5Y.pdf,
  pages 4–11. Year 5 represents the source's year 4–5 phase.
- The source's amounts are unclassified estimates, never summed into a budget.
- Defaults do not assert progress, owners or deadlines. Target KPIs are distinct
  from actual measurements. Progress uses an unweighted count of finished actions.
- CSV exports the full authorized roadmap, not only filtered rows; formula
  prefixes are escaped. Export reuses already authorized data in browser memory.

The standalone prototype and OneNote are not synchronized with this module.
Any real progress already entered in the prototype needs an explicit import;
this release does not silently overwrite either data source.

## Validation

`pnpm --filter @cohvera/api test:strategy` runs validation, source coverage,
summary/export and mocked controller authorization/transaction tests.
Run `pnpm typecheck` and `pnpm --filter @cohvera/web build` as usual.
Before deploying to production, apply the migration to a staging PostgreSQL
database and verify authorized/unauthorized Entra sessions, simultaneous saves,
owner eligibility and persisted reloads. Mocked transaction tests do not prove
actual database rollback or migration compatibility.
