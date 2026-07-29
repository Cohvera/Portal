#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 is required." >&2
  exit 1
fi

corepack enable
corepack prepare pnpm@9.15.0 --activate

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review it before production use."
fi

pnpm install --no-frozen-lockfile
docker compose up -d postgres redis
pnpm db:generate
pnpm --filter @cohvera/database exec prisma migrate deploy
pnpm db:seed
pnpm build

echo "Sprint 1.1 bootstrap completed."
echo "Development: pnpm dev"
echo "Production API: pnpm --filter @cohvera/api start"
echo "Production web: pnpm --filter @cohvera/web start"
