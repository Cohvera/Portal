# Projecten in Cohvera, later gebruiken in Warehouse

Cohvera bewaart projecten centraal per bedrijf. Het formulier blijft eenvoudig: titel, status, kleur en verantwoordelijke. Geen deadline of taken op de projectenpagina. De verantwoordelijke is een naam (geen accounttoewijzing) en wordt bij nieuwe projecten ingevuld met de aangemelde gebruiker.

Medewerkers kunnen projecten aanmaken in hun eigen bedrijven via `projects.create`; managers en bedrijfsbeheerders kunnen ze ook aanpassen. Lezers kunnen alleen kijken. De migratie `20260930100000_project_creation_permission` kent het nieuwe recht toe aan de standaardrollen. Bedrijfsrollen blijven vanuit Entra bepaald.

## Uitleescontract voor Warehouse

De API biedt een read-only v1-contract. Externe routes via Caddy:

- `GET /api/v1/companies/TOMME/projects?q=zoekterm`
- `GET /api/v1/companies/TOMME/projects?cursor=<nextCursor>`
- `GET /api/v1/companies/TOMME/projects/<projectId>`

Een lijst bevat `version: 1`, `projects` en `nextCursor` (null op de laatste pagina). Maximaal 100 projecten per pagina; behoud dezelfde zoekterm bij volgende pagina's. Een project bevat `id`, `companyCode`, `name`, `owner`, `status` en `statusColor`. Er worden geen taken of accountgegevens meegestuurd.

Warehouse moet de combinatie bron `cohvera` + `companyCode` + `id` als referentie bewaren, nooit de projectnaam als sleutel. De ID blijft gelijk wanneer een project wordt hernoemd of afgerond. Afgeronde projecten blijven opvraagbaar voor bestaande magazijnbewegingen. Er is geen verwijderactie voor projecten.

## Wat is al werkend en wat volgt later?

Aanmaken in het portaal en de API om projecten per bedrijf op te halen zijn geïmplementeerd. De endpoints vereisen een geldige portaalsessie met `projects.read` of een toegestaan Entra-applicatietoken; ze zijn niet openbaar. De tests controleren de koppeling van een nieuw project met zijn API-referentie en weigering van toegang tot andere bedrijven.

De bestaande externe warehousetool is nog niet aangepast en haalt deze projecten nog niet automatisch op. De Cohvera-kant ondersteunt applicatie-authenticatie; zie [Warehouse-authenticatie](warehouse-authenticatie.md). De Entra-apps en serverallowlist moeten nog ingesteld worden, en Warehouse moet de tokenaanvraag en projectkeuze implementeren. Er is geen achtergrondsync.

## Uitrollen

Push en deploy de nieuwe code via de normale procedure `sh scripts/deploy.sh`; die past ook de rechtenmigratie toe. Vernieuw het portaal zodat de nieuwe rechten worden geladen. Test vervolgens een nieuw project in het juiste bedrijf. De projectdata blijft in de bestaande PostgreSQL-database bewaard.
