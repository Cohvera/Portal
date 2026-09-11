# Sprint 2 - COEF Management Hubs

Sprint 2 turns the Sprint 1 portal shell into the first visual implementation of the COEF Operational Framework.

## Delivered

- Seven first-class COEF hubs: Strategy, Process, Digital, Operations, Performance, Improvement and Innovation.
- Dedicated route for every hub under `/hubs/<slug>`.
- Central typed hub model in `apps/web/lib/coef.ts`.
- Dashboard cards that link directly into the hubs.
- Per-hub purpose, modules, status and initial metrics.
- Operations Hub explicitly connects to field tools such as keuringen, solar-onderaanneming and laadpaal-werkbon.
- Digital Hub positions the modular tool/plugin layer and middleware.
- Performance Hub establishes the future structure for sales, operations, finance and data-quality KPIs.
- Responsive styling for desktop and mobile.

## Architecture rule

The COEF hub layer is presentation/orchestration. Business functionality remains in isolated plugins and shared platform services. A hub may link to a plugin or consume published API contracts, but may not import plugin internals.

## Acceptance criteria

1. `pnpm typecheck` succeeds.
2. `pnpm --filter @cohvera/web build` succeeds.
3. `/` shows all seven hubs.
4. `/hubs/strategy`, `/hubs/process`, `/hubs/digital`, `/hubs/operations`, `/hubs/performance`, `/hubs/improvement` and `/hubs/innovation` render without server errors.
5. Existing Sprint 1 company switching, plugins, notifications and audit remain operational.
6. Docker deployment and HTTPS on `portal.cohvera.be` remain unchanged.

## Next sprint candidates

- Make Operations Hub live using project/work-order data.
- Make Performance Hub live using a KPI contract and source adapters.
- Add Entra ID production authentication before exposing sensitive write actions.
- Start first full business plugin implementation.
