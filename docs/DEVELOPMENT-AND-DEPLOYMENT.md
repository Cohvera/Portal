# Development & Deployment Workflow

This document defines the recommended Git workflow and deployment process for the Cohvera Portal.

## 1. Goal

We want a simple and predictable path from development to production:

```text
feature/* or codex/*
        |
        v
     sprint-*
        |
        v
   Pull Request
        |
        v
      main
        |
        v
   production
```

The key principle is: **`main` represents production-ready code.** Developers should not develop features directly on `main`.

## 2. Branches

### `main`

`main` is the production branch.

Rules:
- Only tested and reviewed code belongs here.
- Changes should arrive through a Pull Request.
- A successful merge to `main` is the point at which a release can be deployed to production.
- Direct development on `main` should be avoided.

### `sprint-*`

A sprint branch groups work that belongs to the same development sprint, for example:

```text
sprint-1
sprint-2
sprint-3
```

Feature work can be integrated and tested here before the sprint is promoted to `main`.

### `feature/*`

Developers should preferably create a separate branch for a feature or change:

```text
feature/login
feature/dashboard
feature/customer-management
feature/wms
```

### `codex/*`

Branches created by Codex or another coding agent are treated like feature branches. They are **not production branches** and must go through the same review/test process.

Example:

```text
codex/bootstrap-modular-portal
```

## 3. Meaning of Ahead / Behind in GitHub

On the GitHub Branches page:

- **Ahead** = commits present on this branch but not yet on `main`.
- **Behind** = commits present on `main` but missing from this branch.

Example:

```text
sprint-1
Ahead: 5
Behind: 0
```

means that `sprint-1` contains five commits that are not yet in `main`, while it is not missing commits from `main`.

## 4. Standard developer workflow

For normal feature development:

```bash
git checkout sprint-1
git pull

git checkout -b feature/my-feature

# develop + commit
git add .
git commit -m "feat: describe feature"
git push -u origin feature/my-feature
```

Then create a Pull Request:

```text
feature/my-feature -> sprint-1
```

After review and successful CI, merge the PR.

## 5. Sprint to production workflow

When a sprint is ready for release, create a Pull Request:

```text
sprint-1 -> main
```

Before merging, verify:

- CI is green.
- Typecheck succeeds.
- Automated tests succeed.
- Production build succeeds.
- Database migrations have been reviewed.
- Required environment variables/secrets exist in production.
- Relevant functionality has been tested.
- At least one developer has reviewed the PR where practical.

After approval, merge into `main`.

## 6. Current CI

The repository currently contains GitHub Actions CI in:

```text
.github/workflows/ci.yml
```

CI currently runs for Pull Requests and pushes to `main` and `sprint-1`. It provisions PostgreSQL and performs dependency installation, Prisma generation/migrations, development seed, typecheck, tests and build.

**Important:** CI validation is not the same as production deployment. At the time this document was added, the repository contains a CI workflow but no dedicated production deployment workflow in `.github/workflows`.

## 7. Production deployment

The repository already contains a `Dockerfile` and `docker-compose.yml`, so Docker is the expected deployment mechanism unless the infrastructure team decides otherwise.

A production server should always deploy an explicitly approved version from `main`.

A basic manual deployment can look like:

```bash
cd /path/to/portal
git fetch origin
git checkout main
git pull --ff-only origin main

docker compose build
docker compose up -d
```

The exact commands, paths, environment files, reverse proxy and database migration procedure must be confirmed for the actual production infrastructure before first go-live.

## 8. Recommended automated deployment

The preferred target architecture is:

```text
Developer
   |
feature/*
   |
Pull Request
   v
sprint-*
   |
Sprint acceptance
   |
Pull Request
   v
main
   |
GitHub Actions
   |
Build / Test / Release
   v
Production
```

Recommended production automation:

1. Protect `main` with branch protection.
2. Require Pull Requests before merging.
3. Require CI checks to pass.
4. Build an immutable Docker image for the release.
5. Tag the image with the commit SHA and/or release version.
6. Store production secrets outside the repository (GitHub Environments / server secrets).
7. Deploy the approved image to the production server.
8. Run a health check after deployment.
9. Keep the previous image available for rollback.

## 9. Environments

Recommended environments:

| Environment | Source | Purpose |
|---|---|---|
| Development | `feature/*`, `codex/*` | Developer work |
| Test / Sprint | `sprint-*` | Integration and acceptance testing |
| Production | `main` | Live customer environment |

If a permanent staging environment is introduced later, a dedicated `develop` or `staging` branch can be considered. Do not add branches only for the sake of process; keep the workflow as simple as possible.

## 10. Hotfixes

For urgent production fixes:

```text
main
  |
  +--> hotfix/description
           |
           +--> Pull Request -> main
```

After the fix has been merged to `main`, also bring the fix back into the active sprint branch so development does not lose the production correction.

## 11. Rollback

Production deployments must be reversible.

Preferred rollback strategy:

```text
Release N       -> current production
Release N - 1   -> previous known-good image
```

If Release N causes a critical issue, redeploy Release N - 1 and investigate the problem outside production. Database migrations require special attention because not every schema change is automatically reversible.

## 12. Definition of Done for production

A change is production-ready when:

- it has been merged through the agreed Pull Request flow;
- CI is successful;
- required review/acceptance is complete;
- migrations and environment changes are documented;
- production configuration contains the required secrets;
- a deployable Docker image/build exists;
- rollback is possible;
- post-deployment health checks succeed.

## 13. Immediate next steps

Before the first production deployment, the development/infrastructure team should define and implement:

- the production server/hosting target;
- production domain and TLS termination;
- production PostgreSQL location and backup policy;
- secure environment/secrets management;
- Docker image registry (for example GHCR) if using image-based deployment;
- a GitHub Actions production deployment workflow;
- branch protection for `main`;
- production health checks and logging;
- rollback procedure.

Once these are configured, the intended day-to-day release process becomes simply:

```text
Develop -> Test -> PR -> main -> automated production deployment
```
