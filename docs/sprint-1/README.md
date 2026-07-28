# Sprint 1 — Portal Core

Status: **implemented on `codex/bootstrap-modular-portal`**.

## Scope delivered

### Database foundation

Prisma/PostgreSQL data model for companies, users, memberships, roles, permissions, plugins, per-company plugin activation, notifications and audit logs. A repeatable seed creates Cohvera, Q-Home, Tomme Energie and Warco, a portal administrator and the first plugin registrations.

### Authentication foundation

`@cohvera/auth` defines the stable portal identity and permission checks. Development mode supplies a safe local identity. Microsoft Entra ID environment variables and integration boundary are prepared; activation requires the actual Entra tenant/app registration credentials.

### Multi-company

Every membership is scoped to a company. Plugins, notifications and audit records carry company context. The API exposes companies and company selection; the portal shell shows the company switcher.

### RBAC

Roles and permissions are normalized in the database. Permission namespaces are owned by core or the relevant plugin. `portal.admin` acts as the administrative override.

### Plugin registry

The static, versioned plugin manifests remain the source of build-time truth. At API startup they are synchronized into the database. `CompanyPlugin` controls activation and configuration per company.

### Notifications and audit

Shared service functions provide central notification creation and append-only audit logging. Read endpoints return recent records per company.

### Dashboard shell

The MVP shell includes company context, user context, COEF navigation, plugin cards, platform status, notifications and audit sections.

## Run locally

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Definition of done

- Core can compile without importing plugin internals.
- Plugins are individually represented by manifests and company activation records.
- Database entities are tenant-aware.
- Permission namespaces are explicit.
- Development authentication works without external credentials.
- Entra production activation is documented as an environment/configuration task, not hard-coded.
- CI generates Prisma Client before type checking and building.

## Deferred configuration

Live Microsoft Entra authentication cannot be completed without tenant ID, app/client ID, secret or certificate, redirect URIs and approved group/claim mapping. The integration boundary is present so these credentials can be added without changing plugin code.
