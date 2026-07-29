# Sprint 1.1 - Deployable Foundation

Sprint 1.1 delivers a deployable development foundation for the Cohvera Digital Hub.

## Delivered

- pnpm monorepo with Next.js web and NestJS API applications;
- PostgreSQL and Redis development services;
- Prisma schema, migration and seed data;
- companies for Cohvera, Q-Home, Tomme Energie and Warco;
- initial user, role, permissions and company memberships;
- plugin registry and company-plugin activation records;
- health, session, company, plugin, notification and audit endpoints;
- CI validation for install, Prisma generation, migrations, seed, typecheck, tests and build;
- repeatable server bootstrap script.

## Server prerequisites

- Linux server;
- Git;
- Docker with Docker Compose;
- Node.js 22;
- ports 3000 and 4000 available, or reverse-proxied through Nginx/Caddy.

## Install

```bash
git clone --branch sprint-1 https://github.com/Cohvera/Portal.git
cd Portal
chmod +x scripts/bootstrap-server.sh
./scripts/bootstrap-server.sh
```

Review `.env` before exposing the application publicly.

## Run for evaluation

```bash
pnpm dev
```

Open:

- Portal: `http://SERVER_IP:3000`
- API health: `http://SERVER_IP:4000/health`
- Development session: `http://SERVER_IP:4000/session`
- Companies: `http://SERVER_IP:4000/companies`
- Plugin registry: `http://SERVER_IP:4000/plugins`

## Production-like start

After `pnpm build`, run both processes under systemd, PM2 or another process supervisor:

```bash
pnpm --filter @cohvera/api start
pnpm --filter @cohvera/web start
```

Set at minimum:

```env
DATABASE_URL=postgresql://cohvera:CHANGE_ME@localhost:5432/cohvera
WEB_URL=https://portal.example.com
NEXT_PUBLIC_API_URL=https://portal.example.com/api
AUTH_MODE=development
```

`AUTH_MODE=development` is intentionally used for Sprint 1.1. Microsoft Entra ID activation belongs to the authentication increment and must be completed before production access.

## Acceptance criteria

Sprint 1.1 is accepted when GitHub Actions completes the following successfully:

1. dependency installation;
2. Prisma client generation;
3. database migration;
4. seed execution;
5. TypeScript validation;
6. tests;
7. production build.

It must also be possible to open the portal and receive an `ok` response from `/health` after following the documented bootstrap procedure.
