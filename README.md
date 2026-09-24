# Cohvera Digital Hub

Modulair operating platform voor Cohvera, Q-Home, Tomme Energie en Warco, gebaseerd op het COEF Operational Framework.

## Current status

- Sprint 0: repository and plugin foundation
- Sprint 1: database, auth abstraction, RBAC, multi-company, registry, notifications, audit and dashboard shell

See `docs/sprint-1/README.md` for delivered scope and the remaining Entra configuration dependency.

## Start locally

Use Docker for the backend and database, and run the web app locally:

```bash
corepack enable
pnpm install
# First setup only: copy .env.example to .env and set the passwords/domain.
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build api
pnpm --filter @cohvera/web dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health

The web app forwards `/api/*` to `http://127.0.0.1:4000/*`.
Set `API_URL` when starting the web app to use a different backend.
The local Compose file publishes the API only on loopback and is not needed for production.

After backend/schema changes, rebuild the API image, apply migrations and seed the examples:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml build api
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm --no-deps api pnpm --filter @cohvera/database exec prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm --no-deps api pnpm db:seed
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --no-deps api
```

## Project tasks

The shared sidebar remains present across dashboard, hubs, tools and admin pages.
On mobile, open it with the Menu button. The selected company is retained during navigation.

- `/projects`: a simple overview of ongoing projects with title, status, color and owner. Create and edit these fields in a dialog; project cards have no detail navigation, deadlines or task controls.
- `/projects/:id`: redirects to the project overview.
- `/tasks`: tasks assigned to the example user Remko by default; filter by owner, status, deadline or title.
- Dashboard: live counts of open, overdue, blocked and completed tasks.

Seed projects and team members are example data. New projects and tasks persist in PostgreSQL; seed runs do not overwrite tasks.
Status changes use a select control; the board does not use drag and drop.
The development identity remains in place; production authentication and authorization are a separate step.

Run the API integration test against a local development backend (it creates and removes its own test task):

```bash
TEST_API_URL=http://127.0.0.1:4000 pnpm --filter @cohvera/api test
```

## Tools & Solutions

`/tools` shows tools for the selected company, followed by Middleware & Integrations.
Example tools remain shared; custom links added with the plus buttons are scoped to the selected company
and stored in this browser under `cohvera.catalog.entries.v1`. Adding an integration link does not
activate data exchange. Search and category filters preserve card dimensions.
The sidebar, dashboard shortcut and hub links all point to this page.
Tool definitions live in `apps/web/lib/tools.ts`.
Project tasks link to the working project module. Existing tool workflows are labeled as demos;
heat-loss has a preview page until its module is implemented.
Warehouse Manager opens http://84.247.132.149:8000/ in a new tab.
Q-portal opens https://my.q-home.be in a new tab, using its existing login.

## Architecture

The repository is a pnpm monorepo with a portal core, stable contracts, shared services and isolated plugins. Plugins communicate through the Plugin SDK, versioned contracts and events; they do not import each other's internals.

The dashboard shows the three most recently opened distinct tools per selected company.
Launches from the catalog and dashboard are stored locally in this browser; custom tools are included, integrations are excluded.
Opening a tool again moves it to the front. With no history, the dashboard shows an empty state.

Project fields use the existing example team members. Status has a default color that can be customized;
project deadlines are no longer shown or requested. Existing stored data remains intact.
The creation/editing integration test runs inside the API container against its local API and database:

```bash
docker compose exec -e TEST_API_URL=http://127.0.0.1:4000 api pnpm --filter @cohvera/api exec tsx --test tests/project-details.integration.ts
```

This test removes only the project it creates.

## Accounts & permissions

`/admin/accounts` manages account names, normalized email addresses, active status and a role per company.
The standard roles are Portal Admin, Manager, Medewerker and Lezer. The role panel lists their stored permissions.
No invitation emails are sent. Accounts, memberships and audit events are stored in PostgreSQL.
Run `pnpm db:seed` in the backend environment to provision the standard roles and permission keys.

Account administration is explicitly limited to `AUTH_MODE=development` and resolves the fixed Remko identity on the server.
It verifies the active account's `portal.admin` permission; request headers cannot choose an acting user.
Other auth modes reject the new administration endpoints until an authenticated identity adapter is configured.
The current development administrator cannot be edited, and a company cannot lose its last active administrator.
These are account-management foundations, not a completed login system or portal-wide permission enforcement.

```bash
docker compose exec -e TEST_API_URL=http://127.0.0.1:4000 api pnpm --filter @cohvera/api exec tsx --test tests/accounts.integration.ts
```
