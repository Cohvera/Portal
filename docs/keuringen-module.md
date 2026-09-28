# Keuringen in Cohvera

De standaardtegel **Keuringen** opent `/tools/inspections`. **Tomme Keuringen · bestaand portaal** blijft een afzonderlijke externe snelkoppeling naar de NAS. Beide zijn standaard aan Tomme Energie toegewezen; de bedrijfsselectie van tools blijft beheerbaar.

## Werkende eerste implementatie

- Dossiers aanmaken en bewerken met klant, installatie, type, contactgegevens en verantwoordelijke.
- Voorbereidingscontroles, keuringsdatum, keurder, tijdstip en rondenaam.
- Overzichten voor dossiers, planning per dag/ronde, periodieke keuringen, open acties en archief.
- Opvolgacties met verantwoordelijke, streefdatum en afronding; signalering van vervallen acties, ontbrekende resultaten en herkeuringen.
- Rapportnummer, keuringsdatum, interval in maanden en expliciet bevestigde volgende keuringsdatum.
- PDF/JPG/PNG-documenten tot 4 MB; geautoriseerde downloads en gecontroleerd verwijderen.
- Historiek per dossier en gebeurtenissen in de algemene auditlog.
- Vervolgdossier vanaf drie maanden voor de volgende datum; bij herkeuring direct. Eén vervolg per dossier, met behoud van de vorige cyclus en documenten.
- CSV-export van de selectie en afdruk/PDF via de browser.

De nieuwe module begint leeg. Er wordt geen productie-import of synchronisatie uitgevoerd en er worden geen bestaande NAS-bestanden gewijzigd.

## Opslag en API

De Prisma-modellen `Inspection`, `InspectionDocument` en `InspectionEvent` bewaren dossiers, bestanden en historiek in PostgreSQL. Dossiergegevens volgen het gedeelde contract in `packages/contracts/src/inspections.ts`; API-validatie kiest expliciet toegestane velden. Bestanden staan in de database, zodat de databasebackup ook de uploads bevat. Voor grotere volumes kan dit later naar private objectopslag verhuizen.

Basisroute: `/companies/:companyCode/inspections`. Alle lees- en schrijfroutes controleren het actieve bedrijf, tooltoewijzing en de rechten `inspections.read` / `inspections.write` (of `portal.admin`). Microsoft Entra-aanmelding en bedrijfsrechten worden centraal afgedwongen; zie `entra-id-rbac.md`. AUTH_MODE=development blijft een expliciete lokale testmodus.

Elke mutatie aan een bestaand dossier vereist de actuele versie. De update en audit gebeuren samen in een database-transactie. Een verouderde versie geeft HTTP 409; mislukte statuscontroles veranderen de versie niet. De volledige globale toestand wordt nooit vanuit de browser overschreven.

Een conform resultaat vereist een rapport, rapportnummer, uitgevoerde datum en afgeronde opvolgacties. Periodieke conformiteit vereist een volgende datum. Een herkeuring vereist minimaal één open herstelactie. Wijzigingen aan afgesloten/resultaatdossiers vereisen een reden. Verwijderen van bewijsstukken uit zulke dossiers vereist eerst heropening.

## Start / deployment

Gebruik de normale migratiestap uit Docker Compose (`migrate`) na het opnieuw bouwen van de images. Deze past `20260925130000_inspections_module` toe en herstelt de externe Tomme-tegel. Voor bestaande lokale installaties: `prisma migrate deploy` met de juiste DATABASE_URL, gevolgd door herstart van de API en herbouw van de webapp.

## Controles

- `pnpm --filter @cohvera/api test:inspections`: domeinregels; integratietest wordt standaard overgeslagen.
- `INSPECTIONS_INTEGRATION_TEST=1 pnpm --filter @cohvera/api test:inspections`: ook API-integratie, uitsluitend tegen de lokale API op 127.0.0.1:4000 en de bijbehorende ontwikkeldatabase. Vereist een beschikbare Tomme-toewijzing en ontwikkelidentiteit. De test maakt synthetische dossiers en ruimt ze op via Prisma.
- `pnpm --filter @cohvera/api typecheck`
- `pnpm --filter @cohvera/web build`

## Nog geen volledige vervanging van Tomme Keuringen

Deze implementatie is de eerste zelfstandige Cohvera-versie. Geautomatiseerde mailverzending, routeberekening/kaart, ZIP-dossierbundels, NAS-projectmapverkenning en bewijsvergrendeling uit de oude applicatie zijn nog niet overgenomen. Ook historische data-import, productie-identiteit en vergelijking van alle oude workflows staan nog open. Hiervoor blijft de externe Tomme-toepassing beschikbaar. Zet de bestaande tool pas buiten gebruik na een gecontroleerde migratie en functionele acceptatie.
