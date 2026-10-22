# Cohvera Digital Hub

Modulair operating platform voor Cohvera, Q-Home, Tomme Energie en Warco, gebaseerd op het COEF Operational Framework.

## Current status

- Sprint 0: repository and plugin foundation
- Sprint 1: database, auth abstraction, RBAC, multi-company, registry, notifications, audit and dashboard shell

Microsoft Entra ID / RBAC is implemented. See `docs/entra-id-rbac.md` for the plain-language summary, secure configuration, activation and tests.

## Start locally

Use Docker for the backend and database, and run the web app locally:

```bash
corepack enable
pnpm install
# First setup only: copy .env.example to .env and set the passwords/domain.
# For local work without Microsoft credentials, explicitly set AUTH_MODE=development.
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build api
pnpm --filter @cohvera/web dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/health

The web app forwards `/api/*` to `http://127.0.0.1:4000/*`.
Set `API_URL` when starting the web app to use a different backend.
The local Compose file publishes the API only on loopback and is not needed for production.

After backend/schema changes, rebuild the API image, apply migrations and seed the examples:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml build api
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm --no-deps api pnpm --filter @cohvera/database exec prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.local.yml run --rm --no-deps api pnpm db:seed
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --no-deps api
```

## Project tasks

The shared sidebar remains present across dashboard, hubs, tools and admin pages.
On mobile, open it with the Menu button. The selected company is retained during navigation.

- `/projects`: a simple overview of ongoing projects with title, status, color and owner. Create and edit these fields in a dialog; project cards have no detail navigation, deadlines or task controls.
- `/projects/:id`: redirects to the project overview.
- `/tasks`: tasks assigned to the example user Remko by default; filter by owner, status, deadline or title.
- Dashboard: live counts of open, overdue, blocked and completed tasks.

Seed projects and team members are example data. New projects and tasks persist in PostgreSQL; seed runs do not overwrite tasks.
Status changes use a select control; the board does not use drag and drop.
The API enforces the signed-in user’s business permissions. AUTH_MODE=development is an explicit local fallback; AUTH_MODE=entra uses Microsoft sign-in.

Run the API integration test against a local development backend (it creates and removes its own test task):

```bash
TEST_API_URL=http://127.0.0.1:4000 pnpm --filter @cohvera/api test
```

## Tools & Solutions

`/tools` shows tools for the selected company, followed by Middleware & Integrations.
Existing and new tools can be assigned to one or more companies. Use “Bedrijven · Wijzigen”
on a tool card; “Alle bedrijven tonen” makes hidden tools available for reassignment.
Tools and company assignments are stored centrally in PostgreSQL (`ToolCatalog`). Built-in tools default to all companies.
Existing browser-only additions can be explicitly imported with “Lokale tools overnemen”; existing server entries win.
Company assignments filter the catalog and recent tools. External tools retain their own login; portal sign-in does not automatically log users into them. Adding an integration link does not
activate data exchange. Search and category filters preserve card dimensions.
The sidebar, dashboard shortcut and hub links all point to this page.
Tool definitions live in `apps/web/lib/tools.ts`.
Project tasks link to the working project module. Existing tool workflows are labeled as demos;
heat-loss has a preview page until its module is implemented.
Warehouse Manager opens http://84.247.132.149:8000/ in a new tab.
Q-portal opens https://my.q-home.be in a new tab, using its existing login.

## Architecture

The repository is a pnpm monorepo with a portal core, stable contracts, shared services and isolated plugins. Plugins communicate through the Plugin SDK, versioned contracts and events; they do not import each other's internals.

The dashboard shows the three most recently opened distinct tools per selected company.
Launches from the catalog and dashboard are stored locally in this browser; custom tools are included, integrations are excluded.
Opening a tool again moves it to the front. With no history, the dashboard shows an empty state.

Project fields use the existing example team members. Status has a default color that can be customized;
project deadlines are no longer shown or requested. Existing stored data remains intact.
The creation/editing integration test runs inside the API container against its local API and database:

```bash
docker compose exec -e TEST_API_URL=http://127.0.0.1:4000 api pnpm --filter @cohvera/api exec tsx --test tests/project-details.integration.ts
```

This test removes only the project it creates.

## Accounts & permissions

The portal supports Microsoft Entra ID with Authorization Code Flow, PKCE, signed-token validation and server-side sessions. `Portal.User` grants basic entry; `Portal.Admin` grants platform management. Business memberships and roles control company data separately. All API controllers are protected, including direct requests and document downloads.

`/admin/accounts` is a read-only administrator overview. Accounts and group membership are managed in Entra. Configure `ENTRA_GROUP_MAPPINGS` and the ID-token groups claim to synchronize company assignments and business roles at login. A matching group grants its configured companies; removed groups remove access on the next login. The overview shows known portal users and the last synchronized roles/groups, not the entire Microsoft directory. See `docs/entra-id-rbac.md` for configuration.

Read [the implementation and activation guide](docs/entra-id-rbac.md). Fill the private Entra configuration before setting AUTH_MODE=entra. The default session lasts 15 minutes and requires sign-in again for current roles. Development mode keeps the explicit local Remko adapter and must not be used as public production authentication.

```bash
pnpm --filter @cohvera/api test:auth
pnpm --filter @cohvera/api test:inspections
```

The earlier password-login experiment remains reverted. This implementation uses Microsoft identity and separate `PortalSession` / `EntraLoginAttempt` tables, without local passwords.

## Q-box Plenion connector

Een lichte Python-connector stuurt de bestaande LAN-projectexport via HTTPS naar Cohvera. De connector wordt onderhouden in [Cohvera/qbox-connector](https://github.com/Cohvera/qbox-connector). Zie [installatie op Q-box en portaalserver](https://github.com/Cohvera/qbox-connector/blob/main/docs/INSTALLATIE.md).

## Process Hub

`/hubs/process` bevat een groepsbreed register van tien bedrijfsprocessen, met eigenaar,
status, reviewdatum, SharePoint-links en korte PDCA-opvolging. De procedures en CPM
blijven in SharePoint. Portal.Admin kan het overzicht bijwerken; aangemelde
bedrijfsleden kunnen het lezen. Pas de nieuwe database-migratie toe vóór deployment.
Zie [gebruik en inrichting](docs/process-hub.md).

### Eigen bestandsverwerking voor het tv-scherm

De Q-box-worker en de rechtstreekse HFSQL-serverreader worden onderhouden in [Cohvera/qbox-connector](https://github.com/Cohvera/qbox-connector/tree/main/plenion). Alleen de ontvangende API, database-migraties en tv-weergave staan in deze Portal-repository. Hij verwerkt een bevestigde Plenion-bestandskopie via offline iODBC en publiceert contract v4 rechtstreeks naar Cohvera. In de tv-tool toont **Gegevensverbinding** welke route en bronstand actief zijn. Driver, bronmanifest en veldkoppeling moeten vóór productiegebruik worden ingesteld en gecontroleerd; de bestaande connector wordt niet automatisch omgeschakeld.

### Handmatige Plenion-readerimport

Selecteer Q-Home → Projecten → Projecten uit Plenion importeren.
Upload `portal-projects.json`, gemaakt met `sudo ./plenion.sh portal`
in qbox-connector. Projectbeheerrechten voor het doelbedrijf zijn vereist.
De reader exporteert alle statussen zonder bedrijfskeuze. Het portaalprofiel
in `apps/api/src/integrations/reader-import.ts` selecteert voor QHOME code 07.
Historische hoofdversies (VersieAf=1) worden overgeslagen; UITWIP bepaalt afsluiting.
Readerexport v2 koppelt onderliggende records via IDProjectMap aan IDProj,
waarbij het hoofdrecord ProjectMap=1 moet hebben. Het statusfilter geldt voor
het hoofdproject; alle gekoppelde records, inclusief historische versies en andere
statussen, blijven zichtbaar onder dat project. Gelijke namen worden nooit samengevoegd.
Controleer zelf dat het bestand uit de database van het geselecteerde bedrijf komt:
het generieke bestand bevat geen geverifieerde bedrijfsidentiteit.

De import is atomair, weigert verouderde/afgekapte bestanden en dubbele actuele
projectnummers, en behoudt lokale titels en verantwoordelijken. Ontbrekende projecten
worden niet verwijderd. Het tv-scherm gebruikt alleen de laatste bronstand.
Een handmatige import registreert contractversie 5 (v1) of 6 (gegroepeerde v2); oudere automatische Q-box-imports
worden daarna geweigerd om overschrijving door de oude route te voorkomen.
Er is geen automatische upload. Voor groepering is migratie
`20261019160000_plenion_project_documents` vereist. De Compose-migratieservice
past die toe vóór de API start. Update Portal inclusief migratie en de reader;
maak daarna met `sudo ./plenion.sh portal` een nieuwe export en importeer opnieuw.
Bestaande losse offerteprojecten worden op basis van hun bron-ID gemarkeerd als
onderliggend: lijsten, tv-scherm en Inventory-projectselectie tonen ze niet meer.
Hun interne IDs en bestaande verwijzingen blijven behouden; een bestaande
Inventory-verwijzing blijft via de detail-API opvraagbaar.
Oude v1-bestanden worden na een v2-import voor dat bedrijf geweigerd.
Ontbrekende of ongeldige projectmaprelaties blokkeren de hele import.
De import ondersteunt bestanden tot 20 MB en maximaal 20.000 records.

### Automatische readerupload

De Q-box kan dezelfde JSON via POST /api/integrations/qbox/plenion/reader-projects
sturen met header X-Qbox-Key. De API controleert de bedrijfskey en kiest
het doelbedrijf uit QBOX_IMPORT_KEY_QHOME, QBOX_IMPORT_KEY_TOMME of QBOX_IMPORT_KEY_WARCO.
Iedere bedrijfskey moet uniek zijn; laat ongebruikte keys leeg. Een bedrijf in het
bestand wordt niet vertrouwd. QBOX_IMPORT_API_KEY met QBOX_IMPORT_COMPANY blijft
werken als optionele legacy-koppeling. Dubbele keys voor verschillende bedrijven
worden geweigerd. QHOME en WARCO hebben een readerprofiel met status 07; voor TOMME moeten
de selectieafspraken eerst worden ingesteld. De handmatige uploadknop blijft
voorlopig alleen bij Q-Home zichtbaar; Warco kan automatisch via de eigen key importeren.
Dezelfde validatie, transactie, groepering en bescherming tegen oude exports gelden
als voor handmatige imports. Installatie van de 15-minutentimer staat in
qbox-connector plenion/server/README.md. Automatische upload vervangt de handmatige
upload niet en vereist geen aanvullende database-migratie.

### Zichtbaarheid na readerimport

Projecten en de Inventory-projectkeuzelijst tonen bij een readerimport alleen
Plenion-hoofdprojecten waarvan sourceSeenAt overeenkomt met sourceObservedAt van
de laatste geaccepteerde import van dat bedrijf. Projecten die door een statuswijziging
buiten de selectie vallen, verdwijnen dus uit de lijst zonder databaseverwijdering.
Handmatige projecten en andere bronnen blijven zichtbaar. Een mislukte import
wijzigt de geaccepteerde bronstand niet; er geldt hier geen verval na 24 uur.
Een terugkerend project wordt via dezelfde bestaande identiteit weer zichtbaar.
Historische detail-URLs blijven beschikbaar voor bestaande verwijzingen.
Dit vereist alleen een API-update, geen nieuwe migratie of readerupdate.

Historisch (v2): bij Projecten toonde **Recent afgesloten** de Plenion-hoofdprojecten die in de laatste 30 dagen uit een succesvolle readerselectie verdwenen zijn. `sourceOutOfSelectionAt` registreert de eerste sync die dat vaststelde; dit is geen factuurdatum of bevestiging van status 09. Terugkerende projecten verdwijnen uit dit overzicht. Bestaande historische records worden niet achteraf gedateerd. Pas migratie `20261020140000_project_selection_history` toe vóór de bijgewerkte API start. De Q-box hoeft hiervoor niet bijgewerkt te worden.


### Plenion-projectdossier en Updates (reader v3)

Reader v3 importeert alle actuele hoofdprojectmappen (ProjectMap=1, geen parent, VersieAf=0)
met hun direct gekoppelde records, inclusief historische documentversies en alle statussen.
De projectlijst start met **In uitvoering** (profielcode 07, Uit WIP uit). Andere filters tonen
niet-afgesloten, administratief afgesloten en alle ontvangen hoofdprojecten. De statusfilter
kan met de afsluitfilter worden gecombineerd. Het tv-profiel **In uitvoering** blijft code 07 gebruiken.
**Alle open projecten** op tv omvat nadrukkelijk ook niet-afgesloten projecten in andere fasen.

UITWIP wordt afzonderlijk getoond: geen afleiding van betaling, garantie-einde of volledige
facturatie. Namen en statussen van documenten blijven bij hun eigen record. Documentsoortcodes
worden niet zonder bevestigde mapping vertaald naar 'factuur'. Brondata staan onder de details;
Deadline staat ook in de tabel en de CSV. Lege datums blijven leeg; ongeldige datums blokkeren
de hele import. De maximale export blijft 20.000 records / 20 MB; afgekapt wordt niet geïmporteerd.

**Updates** bewaart nieuwe hoofdprojecten/documenten, status-, Uit WIP- en datumwijzigingen
in dezelfde transactie als de import. Het overzicht toont de 200 nieuwste updates van 30 dagen,
per bedrijf. De eerste v3-import is een baseline zonder historische meldingen. Daarna worden
wijzigingen bij de eerstvolgende succesvolle sync geregistreerd, zonder verzonnen bronmoment.
Dubbele/oudere exports maken geen nieuwe events. Na v3 wordt terugschakelen naar v1/v2 geweigerd.

Deploy eerst Portal (API én web) inclusief migratie `20261022120000_project_lifecycle`.
Daarna de Q-box-reader uit qbox-connector bijwerken, opnieuw installeren en `sudo ./plenion.sh sync`.
De bestaande timer blijft actief. Een live HFSQL-query met deze datumvelden moet na installatie
worden gecontroleerd; lokale tests gebruiken fixtures, geen verbinding met de bedrijfsdatabase.


Handmatig projecten aanmaken is uitgeschakeld (UI en POST /companies/:code/projects).
Bestaande projecten blijven bewerkbaar. Verwijder handmatige projecten voor alle bedrijven met
`packages/database/scripts/remove-manual-projects.cjs`: zonder argumenten controleert het script,
met `--apply --backup /pad/bestand.json` maakt het eerst een exclusieve back-up en verwijdert het
alleen records zonder externalSource, externalId en sourceRecordId. Gekoppelde taken blokkeren de
volledige verwijdering. Importgegevens blijven behouden. Bewaar back-ups buiten Git.
