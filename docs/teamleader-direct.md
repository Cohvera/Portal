# Teamleader Focus rechtstreeks koppelen aan QHOME

Portal leest de projecten zelf uit Teamleader. De Q-box, Python-connector en lokale
computer zijn hiervoor niet nodig. De bestaande Q-box-configuraties, timers,
importsleutels en endpoints blijven beschikbaar en worden niet aangepast.

## Eenmalige serverinstellingen

Maak een Teamleader Focus OAuth-app met toegang tot `projects`. Registreer exact:

```text
https://portal.cohvera.be/api/companies/QHOME/middleware/teamleader/callback
```

Voor een ander Portal-domein gebruik je het callbackadres dat het Middleware-scherm
toont. Het adres wordt afgeleid van de publieke Portal-origin (bij Entra: het domein
van `ENTRA_REDIRECT_URI`). Zorg dat de app toegang heeft tot het juiste Teamleader-account.

Vul op de Portal-server in `.env` in:

```dotenv
TEAMLEADER_CLIENT_ID=...
TEAMLEADER_CLIENT_SECRET=...
TEAMLEADER_TOKEN_ENCRYPTION_KEY=...
```

Genereer de versleutelingssleutel eenmalig met `openssl rand -hex 32`. Bewaar hem in
je servergeheimen en beveiligde backup. Gebruik bij iedere herstart en op iedere
API-replica dezelfde waarde: bestaande tokens worden ermee ontsleuteld.
De directe koppeling heeft **geen** `TEAMLEADER_IMPORT_KEY_QHOME` nodig; die variabele
is alleen voor de eerdere losse Python-connector. Start die connector niet óók als
periodieke QHOME-import wanneer de directe koppeling actief is.

## Uitrollen

Publiceer de gewijzigde code naar de server en bouw de migratie-, API- en webimages.
Gebruik dezelfde Compose-bestanden als bij je bestaande installatie. Voor de
installatie met warehouse-override:

```sh
cd ~/Portal
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml build migrate api web
# Alleen migraties; geen nieuwe seed of wijziging aan bestaande voorbeeldprojecten.
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml run --rm --no-deps migrate pnpm --filter @cohvera/database exec prisma migrate deploy
# Voer dit pas uit als de migratie hierboven is geslaagd.
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up -d --no-deps api web
```

De migratie voegt uitsluitend `TeamleaderConnection` en `TeamleaderSyncRun` toe.
Ze wijzigt geen bestaande projecten of Q-box-tabellen. PostgreSQL moet draaien
voordat de migratie wordt uitgevoerd. Zonder warehouse-override laat je het tweede
`-f`-argument weg.

## Verbinden

1. Selecteer **QHOME → Tools & Middleware → Teamleader**.
2. Kies **Klassieke projecten** of **Nieuwe projecten**, passend bij jullie account.
3. Klik **Verbinden met Teamleader** en meld je aan als QHOME-gebruiker die alle
   gewenste projecten kan lezen. Keur de projecttoegang goed.
4. Na terugkeer start de eerste sync binnen ongeveer 30 seconden.
5. Controleer de laatste geslaagde sync, het aantal projecten en de bronfilter
   **Teamleader** bij Projecten. Test daarna ook **Nu synchroniseren**.

De verbinding beheren vereist `projects.manage`; status bekijken vereist
`projects.read`, steeds binnen QHOME. De OAuth-aanmelding vervalt na 10 minuten en
moet door dezelfde ingelogde Portal-gebruiker worden afgerond. De modulekeuze wordt
na de eerste verbinding vastgezet om dubbele koppelingen na een modulewissel te
voorkomen. Zo'n wissel vraagt eerst een migratie van project-ID's.

## Werking en herstel

- De API controleert elke 30 seconden of er werk klaarstaat. Na iedere afgeronde
  poging wordt de volgende sync 15 minuten later gepland. Dit blijft werken als
  de browser gesloten is en hervat na een API-herstart.
- Handmatige en automatische syncs delen een databasevergrendeling. Ook meerdere
  API-replica's kunnen dezelfde sync niet gelijktijdig uitvoeren. Een verlopen
  vergrendeling wordt na een onderbroken proces automatisch vrijgegeven.
- Access- en refresh-tokens worden met AES-256-GCM versleuteld. Nieuwe refresh-tokens
  worden vóór het uitlezen van projecten opgeslagen. Tokens verschijnen niet in
  API-antwoorden of synchronisatielogs.
- Alle projectpagina's worden opgehaald en gevalideerd voordat de import start.
  Een mislukte of onvolledige export vervangt de bestaande projectgegevens niet.
- Projecten worden per bedrijf, bron en Teamleader-ID bijgewerkt. Handmatige
  verantwoordelijken en taken blijven behouden. Ontbrekende projecten worden niet
  verwijderd. De bestaande Plenion- en Q-box-imports gebruiken hun eigen bron.
- De log toont de laatste 30 pogingen; registraties ouder dan 30 dagen worden
  bij de volgende poging opgeruimd.
- **Verbinding verbreken** verwijdert de lokale tokens en stopt toekomstige directe
  syncs; bestaande projecten blijven staan. Trek indien gewenst ook de app-toegang
  in Teamleader in. Verbreken wacht tot een lopende sync klaar is.
- Bij HTTP 401/403 controleer je projectrechten en verbind je zo nodig opnieuw.
  Bij HTTP 429 volgt een nieuwe poging na 15 minuten; de connector gaat niet
  onbegrensd opnieuw proberen.

De projectimport bevat titel, referentie, beschrijving, status, startdatum en
enddatum/deadline. Klantnamen en Teamleader-gebruikers worden nog niet gekoppeld.
De laatste bronstatus wordt bij iedere sync toegepast. Uit WIP en de
Plenion-statuscontrole gelden niet voor Teamleader-projecten.

API-referentie: [Teamleader Focus developer documentation](https://developer.focus.teamleader.eu/).

## Controle bij wijzigingen

```sh
pnpm --filter @cohvera/database prisma:generate
pnpm --filter @cohvera/api typecheck
pnpm --filter @cohvera/web typecheck
cd apps/api
node --import tsx --test src/integrations/teamleader*.test.ts src/integrations/qbox*.test.ts
```

De tests gebruiken gesimuleerde Teamleader-antwoorden. Een echte OAuth-aanmelding en
productiesync vereisen de clientgegevens en toestemming van de QHOME-gebruiker.
