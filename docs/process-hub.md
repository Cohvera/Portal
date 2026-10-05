# Process Hub

`/hubs/process` is het groepsbrede overzicht van tien bedrijfsprocessen. De selectie van een business unit verandert deze gedeelde standaarden niet. Gedetailleerde procedures, varianten per bedrijf, werkinstructies en CPM staan in SharePoint. De portal bewaart uitsluitend registergegevens en een korte verbeteropvolging.

## Eerste gebruik

1. Pas de database-migratie toe met `pnpm --filter @cohvera/database exec prisma migrate deploy` en genereer de client met `pnpm db:generate`. Gebruik de bestaande deploymentprocedure voor API en web. De bestaande bedrijf/identiteitsseed moet zijn uitgevoerd.
2. Open Process Hub. De tien processen verschijnen zonder aparte process-seed. Ze starten als **Te beschrijven**, met werking **Nog niet beoordeeld**. BP-01, BP-02 en BP-03 krijgen voorrang voor de eerste uitwerking. Dit zijn startvoorstellen, geen vaststellingen over de bestaande werking.
3. Maak de volledige procesdocumenten of pagina's in jullie SharePoint-site. Gebruik BP-01 t/m BP-10 als vaste identificatie. Leg daarin doel, procesgrenzen, stappen, uitvoerders, overdrachten, controles en hulpmiddelen vast. Leg bedrijfsvarianten bij dezelfde groepsstandaard vast.
4. Een gebruiker met Microsoft-app-rol `Portal.Admin` opent een proces, kiest **Overzicht bijwerken**, wijst de echte eigenaar toe en plakt de exacte document- of paginalink. Er worden geen SharePoint-paden verzonnen of automatisch documenten aangemaakt.
5. BP-02 (Order to Delivery) verwijst apart naar de bestaande CPM-methodologie. CPM wordt niet opnieuw gedefinieerd in de portal.
6. Spreek per proces een doel/SLA en reviewdatum af. Werk handmatige metingen bij met de datum en context. De portal haalt geen KPI's of documentstatus uit SharePoint op.

SharePoint-links moeten HTTPS zijn op een subdomein van `sharepoint.com`, zonder inloggegevens. Gebruik de rechtstreekse SharePoint-link, geen verkorte URL. Toegangsrechten blijven in SharePoint beheerd; een portal-link verleent geen documenttoegang.

## Visueel management en continue verbetering

Documentatiestatus (**Te beschrijven → In uitwerking → In test → Goedgekeurd → Actief**, of **Te herzien**) is gescheiden van proceswerking (**Nog niet beoordeeld**, **Op koers**, **Aandacht**, **Geblokkeerd**). Een actieve of goedgekeurde standaard vereist eigenaar en documentlink. Elke beoordeelde werking vereist onderbouwing. Aandacht en blokkades vereisen een knelpunt en volgende actie.

Een verstreken review, status Te herzien, of werking Aandacht/Geblokkeerd verschijnt in Verbeteropvolging. Geen aandachtspunten betekent niet dat de onbeoordeelde processen goed werken. De teller van onbeoordeelde processen blijft zichtbaar.

De korte PDCA-opvolging bevat knelpunt/oorzaak, tegenmaatregel en effectcontrole/borging. Dit is één actuele samenvatting per bedrijfsproces, geen volledige backlog of historiek van verbetertrajecten. Werk na een bewezen verbetering de standaard in SharePoint bij en bepaal een volgend reviewmoment. Voor de eerste reviews: bespreek BP-01, BP-02 en BP-03 samen zodat overdrachten tussen sales, uitvoering en facturatie helder zijn.

Inspiratie: [Danaher Business System](https://www.danaher.com/how-we-work/danaher-business-system) beschrijft continue verbetering, duidelijke rollen en meetbare resultaten. De portal vertaalt deze principes naar een eenvoudige eigen werkwijze voor Cohvera; dit is geen formele DBS-implementatie.

## Opslag en toegang

- `GET /processes`: alleen aangemelde gebruikers met minstens één actieve bedrijfstoewijzing. Het register is groepsbreed, inclusief eigenaar, metingen en verbeterinformatie; registreer hier geen vertrouwelijke bedrijfsdossiers.
- `PATCH /processes/:id`: uitsluitend Portal.Admin. De bestaande sessie- en CSRF-controles blijven gelden. Bedrijfsbeheerder zijn is op zichzelf geen toestemming om deze groepsstandaarden te wijzigen.
- `ProcessRegister` in PostgreSQL bewaart de metadata. De standaardnamen, procesgrenzen en voorgestelde meetpunten staan in `packages/contracts/src/processes.ts`.
- Elke wijziging schrijft een audit-event onder Cohvera. Versiecontrole voorkomt dat gelijktijdige updates elkaar stilzwijgend overschrijven. Bij een conflict: sluit de fiche, vernieuw het overzicht en voer de wijziging opnieuw in.
- Documenten, documentversies, inhoud en goedkeuringsworkflows blijven in SharePoint. De portalstatus wordt handmatig bijgehouden.

## Verificatie

```bash
pnpm --filter @cohvera/api exec tsx --test src/processes.test.ts
pnpm --filter @cohvera/contracts typecheck
pnpm --filter @cohvera/api typecheck
pnpm --filter @cohvera/web typecheck
pnpm --filter @cohvera/web build
```

Controleer na deployment opslaan en opnieuw laden vanuit een tweede browser, leesrechten voor gewone gebruikers, de echte SharePoint-links en het CPM-document. Voorbeeldrollen en tekst zijn geen bevestigde eigenaars of echte prestatiemetingen.
