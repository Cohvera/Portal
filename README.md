# Cohvera Digital Hub

Modulair operating platform voor Cohvera, Q-Home, Tomme Energie en Warco, gebaseerd op het COEF Operational Framework.

## Current status

- Sprint 0: repository and plugin foundation
- Sprint 1: database, auth abstraction, RBAC, multi-company, registry, notifications, audit and dashboard shell

See `docs/sprint-1/README.md` for delivered scope and the remaining Entra configuration dependency.

## Start locally

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

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health
- Session: http://localhost:4000/session
- Plugin registry: http://localhost:4000/plugins

## Architecture

The repository is a pnpm monorepo with a portal core, stable contracts, shared services and isolated plugins. Plugins communicate through the Plugin SDK, versioned contracts and events; they do not import each other's internals.
