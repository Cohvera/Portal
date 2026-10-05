# Cohvera Digital Hub

Modulair operating platform voor Cohvera, Q-Home, Tomme Energie en Warco, gebaseerd op het COEF Operational Framework.

## Current status

- Sprint 0: repository and plugin foundation
- Sprint 1: database, auth abstraction, RBAC, multi-company, registry, notifications, audit and dashboard shell

Microsoft Entra ID / RBAC is implemented. See `docs/entra-id-rbac.md` for the plain-language summary, secure configuration, activation and tests.

## Start locally

Use Docker for the backend and database, and run the web app locally:

```bash
corepack enable
pnpm install
# First setup only: copy .env.example to .env and set the passwords/domain.
# For local work without Microsoft credentials, explicitly set AUTH_MODE=development.
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
The API enforces the signed-in user’s business permissions. AUTH_MODE=development is an explicit local fallback; AUTH_MODE=entra uses Microsoft sign-in.

Run the API integration test against a local development backend (it creates and removes its own test task):

```bash
TEST_API_URL=http://127.0.0.1:4000 pnpm --filter @cohvera/api test
```

## Tools & Solutions

`/tools` shows tools for the selected company, followed by Middleware & Integrations.
Existing and new tools can be assigned to one or more companies. Use “Bedrijven · Wijzigen”
on a tool card; “Alle bedrijven tonen” makes hidden tools available for reassignment.
Tools and company assignments are stored centrally in PostgreSQL (`ToolCatalog`). Built-in tools default to all companies.
Existing browser-only additions can be explicitly imported with “Lokale tools overnemen”; existing server entries win.
Company assignments filter the catalog and recent tools. External tools retain their own login; portal sign-in does not automatically log users into them. Adding an integration link does not
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

The portal supports Microsoft Entra ID with Authorization Code Flow, PKCE, signed-token validation and server-side sessions. `Portal.User` grants basic entry; `Portal.Admin` grants platform management. Business memberships and roles control company data separately. All API controllers are protected, including direct requests and document downloads.

`/admin/accounts` is a read-only administrator overview. Accounts and group membership are managed in Entra. Configure `ENTRA_GROUP_MAPPINGS` and the ID-token groups claim to synchronize company assignments and business roles at login. A matching group grants its configured companies; removed groups remove access on the next login. The overview shows known portal users and the last synchronized roles/groups, not the entire Microsoft directory. See `docs/entra-id-rbac.md` for configuration.

Read [the implementation and activation guide](docs/entra-id-rbac.md). Fill the private Entra configuration before setting AUTH_MODE=entra. The default session lasts 15 minutes and requires sign-in again for current roles. Development mode keeps the explicit local Remko adapter and must not be used as public production authentication.

```bash
pnpm --filter @cohvera/api test:auth
pnpm --filter @cohvera/api test:inspections
```

The earlier password-login experiment remains reverted. This implementation uses Microsoft identity and separate `PortalSession` / `EntraLoginAttempt` tables, without local passwords.

## Q-box Plenion connector

Een lichte Python-connector stuurt de bestaande LAN-projectexport via HTTPS naar Cohvera. Zie [installatie op Q-box en portaalserver](connectors/qbox/README.md).

## Process Hub

`/hubs/process` bevat een groepsbreed register van tien bedrijfsprocessen, met eigenaar,
status, reviewdatum, SharePoint-links en korte PDCA-opvolging. De procedures en CPM
blijven in SharePoint. Portal.Admin kan het overzicht bijwerken; aangemelde
bedrijfsleden kunnen het lezen. Pas de nieuwe database-migratie toe vóór deployment.
Zie [gebruik en inrichting](docs/process-hub.md).
