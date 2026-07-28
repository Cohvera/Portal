# Cohvera Portal Architecture

De Portal is een modulaire monoliet met geïsoleerde plugins.

## Regels

1. Plugins gebruiken alleen de Plugin SDK en gepubliceerde contracten.
2. Een plugin importeert nooit code of database-entiteiten van een andere plugin.
3. Elke plugin heeft een eigen namespace en later een eigen PostgreSQL-schema.
4. Corefunctionaliteit blijft bruikbaar wanneer een plugin ontbreekt of uitgeschakeld is.
5. Integratie gebeurt via versioned API-contracten en domain events.

## Platformlagen

- `apps/web`: portal shell en gebruikersinterface
- `apps/api`: centrale API en plugin registry
- `packages/contracts`: stabiele types en events
- `packages/plugin-sdk`: validatie en registratie
- `packages/ui`: gedeelde presentational components
- `plugins/*`: functioneel geïsoleerde modules
