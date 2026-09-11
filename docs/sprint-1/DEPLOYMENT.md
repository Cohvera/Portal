# Sprint 1 deployment

## Goal

Sprint 1 is deployable as a five-service Docker Compose stack: PostgreSQL, Redis, NestJS API, Next.js web and Caddy. Caddy is the only public entry point and serves HTTPS on port 443.

## Prerequisites

- Linux server with Docker Engine and Docker Compose v2.
- Public DNS A/AAAA record for the portal hostname pointing to the server.
- TCP ports 80 and 443 reachable from the internet. UDP 443 is optional but enabled for HTTP/3.
- A strong PostgreSQL password.

## Install

```bash
git clone https://github.com/Cohvera/Portal.git
cd Portal
git checkout fix/sprint-1-deployable
cp .env.example .env
nano .env
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Set at minimum:

```dotenv
PORTAL_DOMAIN=portal.yourdomain.tld
POSTGRES_PASSWORD=a-long-random-password
AUTH_MODE=development
```

Caddy automatically requests and renews a public TLS certificate for `PORTAL_DOMAIN`. Do not place a certificate or private key in Git.

## Routing

- `https://PORTAL_DOMAIN/` -> Next.js web
- `https://PORTAL_DOMAIN/api/health` -> NestJS `/health`
- `https://PORTAL_DOMAIN/api/companies` -> NestJS `/companies`
- `https://PORTAL_DOMAIN/api/plugins` -> NestJS `/plugins`

PostgreSQL, Redis, API port 4000 and web port 3000 are not published to the internet.

## Updating

```bash
git pull
./scripts/deploy.sh
```

Database migrations run before the API starts. The seed is idempotent and initializes the Cohvera companies, base permissions and plugin registry.

## Verification

```bash
docker compose ps
curl -I https://$PORTAL_DOMAIN/
curl https://$PORTAL_DOMAIN/api/health
```

Expected API response contains `status: ok`.

## Security boundary for Sprint 1

TLS, private backend networking and database credentials are included. `AUTH_MODE=development` is intentionally an MVP identity and must not be considered production authentication. Microsoft Entra ID must be enabled before exposing sensitive company data or write actions to real users.

## Rollback

Application containers are stateless. Check out the previous Git commit and run `./scripts/deploy.sh` again. Do not automatically roll back database migrations; use a reviewed forward migration when schema changes have already been applied.
