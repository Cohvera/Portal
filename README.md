# Cohvera Digital Hub

Modulair operating platform voor Cohvera, Q-Home, Tomme Energie en Warco, gebaseerd op het COEF Operational Framework.

## Starten

```bash
corepack enable
pnpm install
docker compose up -d
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health
- Plugin registry: http://localhost:4000/plugins

## Architectuur

De repository is een pnpm-monorepo met een portal core, gedeelde contracten en geïsoleerde plugins. Zie `docs/architecture` en `docs/plugin-development`.

## Eerste plugins

- Ventilatie Cloud
- Keuringen
- Solar Onderaanneming
- Laadpaal Werkbon
