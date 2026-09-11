# Sprint 1 - Portal Core

Status: functionally complete MVP foundation.

## Delivered

- Next.js portal shell connected to the live API.
- NestJS API with health, session, companies, company switching, plugin registry, notifications and audit endpoints.
- PostgreSQL + Prisma data model and seed data.
- Database-backed multi-company context for Cohvera, Q-Home, Tomme Energie and Warco.
- Database-backed Portal Admin role and permissions for the seeded development user.
- Company-specific plugin enablement.
- Central audit logging for company selection.
- Central notification data model and API.
- Docker Compose deployment with web, API, PostgreSQL, Redis, migrations and Caddy.
- HTTPS on `portal.cohvera.be` with automatic certificate management.
- Plugin SDK and stable contracts package.

## MVP identity

Sprint 1 intentionally keeps `AUTH_MODE=development` so deployment can be validated independently of Microsoft Entra configuration. The seeded development user is resolved from PostgreSQL and its company memberships, role and permissions are returned by `/api/session`.

Before sensitive production data or write workflows are enabled, replace development identity with Microsoft Entra ID authentication.

## Runtime acceptance

After deployment verify:

```bash
curl https://portal.cohvera.be/api/health
curl https://portal.cohvera.be/api/session?companyCode=COH
curl https://portal.cohvera.be/api/companies
```

The browser dashboard at `https://portal.cohvera.be` must allow switching between Cohvera, Q-Home, Tomme Energie and Warco without a rebuild. Switching company writes an audit event and reloads the company-specific plugin, notification and audit context.

## Architectural boundary

Plugins do not import each other's internals. Shared behavior goes through `packages/contracts`, `packages/plugin-sdk`, core APIs and later domain events. Plugin activation is stored per company in `CompanyPlugin`.

## Next sprint

Sprint 2 should add Microsoft Entra ID, production session handling, route authorization and the detailed COEF hub modules without changing plugin isolation rules.
