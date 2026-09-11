# Sprint 3 - Operational Tools MVP

Sprint 3 turns the plugin catalog into clickable operational workspaces while preserving plugin isolation.

## Scope

Four first-class tools are exposed through stable routes:

- `/tools/ventilation-cloud`
- `/tools/inspections`
- `/tools/solar-subcontracting`
- `/tools/charging-workorders`

Each workspace contains a common operational shell with KPI cards, a workflow view, recent activity and quick actions. The shell is driven by typed metadata in `apps/web/lib/tools.ts` so future plugins can reuse the same interaction model without modifying existing plugin implementations.

The API exposes `GET /tools/:toolId/summary` for the first operational snapshot contract. Sprint 3 intentionally uses seeded/demo operational values while the persistent domain models remain isolated for later plugin-specific migrations.

## Architecture rules

1. Plugin routes remain under `/tools/<plugin-id>`.
2. A plugin must not import another plugin.
3. Cross-plugin orchestration belongs in the COEF hubs or published API/contracts.
4. New plugin workspaces should reuse the portal shell but own their domain data and migrations.
5. Company enablement remains controlled by the Sprint 1 plugin registry.

## Acceptance criteria

- Dashboard plugin cards open the corresponding workspace.
- All four tool routes render through the reusable tool shell.
- Tool summary API responds for all four MVP tools.
- Unknown tool summary requests return an empty safe snapshot.
- Existing company switching, hubs, notifications and audit remain unaffected.
- Docker and HTTPS deployment remain unchanged.
- Typecheck, build and Docker build must pass before merge.

## Next sprint

Sprint 4 should make the first selected tool persistent end-to-end (recommended: Laadpaal Werkbon), including domain schema, CRUD API, attachments/measurements and printable completion output, while leaving the other plugins untouched.
