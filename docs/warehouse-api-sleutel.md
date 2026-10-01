# Cohvera en Inventory verbinden op de server

**Doel:** in Inventory projecten uit Cohvera kiezen, zonder een nieuwe Entra-applicatierol aan te maken. Microsoft-login in Inventory is optioneel voor deze koppeling. De twee applicaties gebruiken onderling één aparte sleutel waarmee alleen projecten gelezen kunnen worden.

Deze handleiding past configuratie aan op de server `84.247.132.149`. De code moet eerst in GitHub staan. De lokale wijzigingen zijn niet automatisch op de server beschikbaar.

## 1. Open de juiste server vanaf je Mac

**Waar:** Terminal op je Mac.

```sh
ssh root@84.247.132.149
```

Gebruik je gebruikelijke SSH-gebruiker als je niet met `root` inlogt. Alle volgende terminalcommando's voer je **in deze SSH-sessie op de server** uit.

Dit is de server waarop de Docker-containers van het portaal en de warehouse tool draaien. Het is niet de Synology op `192.168.10.228`.

## 2. Zoek de echte installatiemappen op

**Waar:** op de server; je huidige map maakt voor deze stap niet uit.

In je eerdere screenshot stond `/opt/apps/cohvera/src`, maar die map bevatte mogelijk een oudere applicatie. Daarom gebruiken we de mappen van de daadwerkelijk draaiende containers. De exacte huidige serverpaden zijn nog niet bevestigd.

Bekijk eerst de containers:

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

In je eerdere overzicht heetten de juiste containers `portal-api-1` en `cohvera-inventory`. Vraag voor die containers de installatiemap op:

```sh
docker inspect portal-api-1 --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
docker inspect cohvera-inventory --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

De eerste uitvoer is de **Portal-map**, de tweede de **Inventory-map**. Zijn de containernamen veranderd? Vervang ze in deze twee commando's door de namen uit `docker ps`.

Sla de gevonden mappen op, zodat de volgende commando's automatisch de juiste locatie gebruiken:

```sh
PORTAL_DIR=$(docker inspect portal-api-1 --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')
INVENTORY_DIR=$(docker inspect cohvera-inventory --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}')
printf 'Portal-map: %s\nInventory-map: %s\n' "$PORTAL_DIR" "$INVENTORY_DIR"
```

**Ga alleen verder als beide paden bestaan en kloppen.** Geeft Docker een fout, lege waarde of `<no value>`? Vraag dan de gebruikte composebestanden op:

```sh
docker inspect portal-api-1 --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}'
docker inspect cohvera-inventory --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}'
```

De map van het basisbestand `docker-compose.yml` is normaal de gezochte map. Als de uitvoer ook andere composebestanden vermeldt, behoud die bij de startcommando's hieronder en voeg ons extra bestand als laatste toe. Staan de bestanden niet meer op die locatie, zoek dan eerst de actuele deploymentmap op; maak geen nieuwe lege installatie aan.

Deze variabelen blijven alleen bestaan zolang deze SSH-sessie open is. Voer stap 2 opnieuw uit als je opnieuw inlogt.

## 3. Zet de nieuwe code op de server

**Vooraf:** zorg dat de wijzigingen van **beide repositories** naar GitHub gepusht zijn en op de branch staan die de server gebruikt.

**Waar: Portal-map op de server.**

```sh
cd "$PORTAL_DIR"
pwd
git status --short
git branch --show-current
git pull --ff-only
ls docker-compose.yml docker-compose.warehouse.yml
```

**Waar: Inventory-map op de server.**

```sh
cd "$INVENTORY_DIR"
pwd
git status --short
git branch --show-current
git pull --ff-only
ls docker-compose.yml docker-compose.cohvera.yml
```

`git pull` werkt de huidige branch bij. Wil je `main` uitrollen, controleer dan dat de server die branch gebruikt en dat de wijzigingen daar staan. Bij een mergefout, lokale wijzigingen die de update blokkeren of een ontbrekend extra composebestand: los eerst de code-update op. Gebruik geen `git reset --hard` om dit te omzeilen.

De twee configuratiebestanden die je hierna aanpast zijn:

| Applicatie | Bestand op de server | Openen |
| --- | --- | --- |
| Cohvera | `.env` in de gevonden Portal-map | `nano "$PORTAL_DIR/.env"` |
| Inventory | `.env` in de gevonden Inventory-map | `nano "$INVENTORY_DIR/.env"` |

Je past de bestaande `.env` aan. Vervang die niet door `.env.example`: daar ontbreken je huidige database- en logininstellingen.

## 4. Maak het interne netwerk en één sleutel

**Waar:** op de server; de huidige map maakt niet uit.

Controleer of het netwerk bestaat:

```sh
docker network ls --filter name=cohvera-warehouse
```

Staat `cohvera-warehouse` er nog niet tussen? Maak het eenmalig aan:

```sh
docker network create cohvera-warehouse
```

Genereer vervolgens **één** sleutel:

```sh
openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; printf '\n'
```

Kopieer de uitvoer. Plak exact dezelfde waarde in beide `.env`-bestanden hieronder. Genereer niet een tweede sleutel voor Inventory. Deel de sleutel niet in chat of GitHub.

## 5. Vul Cohvera's `.env` aan

**Waar:** op de server.

```sh
nano "$PORTAL_DIR/.env"
```

Voeg deze regels toe, of pas de bestaande regels met dezelfde naam aan:

```dotenv
WAREHOUSE_PROJECTS_API_KEY=PLAK_HIER_DE_SLEUTEL
WAREHOUSE_PROJECTS_COMPANIES=TOMME
```

Vervang `PLAK_HIER_DE_SLEUTEL` door de gegenereerde waarde. Laat elke instelling maar één keer in het bestand staan.

**Opslaan in nano:** `Ctrl+O`, daarna `Enter`. Sluiten: `Ctrl+X`.

## 6. Vul Inventory's `.env` aan

**Waar:** op de server.

```sh
nano "$INVENTORY_DIR/.env"
```

Voeg deze regels toe, of pas de bestaande regels aan:

```dotenv
COHVERA_PROJECTS_ENABLED=1
COHVERA_AUTH_MODE=api_key
COHVERA_API_KEY=PLAK_HIER_DEZELFDE_SLEUTEL
COHVERA_API_URL=http://cohvera-projects-api:4000
COHVERA_COMPANY_CODES=TOMME
```

Neem het interne adres letterlijk over. Voeg geen `/api` toe en vervang het niet door het publieke IP-adres. Docker koppelt de naam `cohvera-projects-api` aan de Cohvera API-container.

**Gebruikerslogin:** de koppeling werkt ook met `ENTRA_AUTH_ENABLED=0`. Je hoeft Microsoft-login niet aan te zetten om projecten op te halen. Een al ingeschakelde login blijft werken. Zonder login kunnen bezoekers van Inventory ook de gekoppelde projecten gebruiken. De API-sleutel en bedrijfsbeperkingen blijven verplicht.

Voor deze connector zijn `COHVERA_TENANT_ID`, `COHVERA_CLIENT_ID`, `COHVERA_CLIENT_SECRET` en `COHVERA_API_CLIENT_ID` niet nodig. Laat bestaande `ENTRA_…`-instellingen voor de gebruikerslogin staan.

Opslaan: `Ctrl+O`, `Enter`, `Ctrl+X`.

Wil je later ook Q-Home en Warco beschikbaar maken? Zet dan in beide bestanden de bijbehorende bedrijfslijst op `TOMME,QHOME,WARCO`. Alle Inventory-gebruikers krijgen via de connector toegang tot die ingestelde bedrijven; dit is geen rechteninstelling per medewerker.

## 7. Bouw en herstart eerst Cohvera, daarna Inventory

**Waar: Portal-map op de server.**

```sh
cd "$PORTAL_DIR"
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml ps
```

Bij een succesvolle `config --quiet` krijg je geen uitvoer. Bij een fout: los die eerst op. Wacht tot de API draait en gezond is voordat je verdergaat.

**Waar: Inventory-map op de server.**

```sh
cd "$INVENTORY_DIR"
docker compose -f docker-compose.yml -f docker-compose.cohvera.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.cohvera.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.cohvera.yml ps
```

De build kan enkele minuten duren. De containers worden vervangen; bestaande data blijft in de bestaande volumes/mappen. Gebruik geen `down -v`.

**Ook bij toekomstige updates:** gebruik deze volledige commando's met beide `-f`-bestanden. Voeg ze ook toe aan een eventueel automatisch deploymentscript. Anders kan de gedeelde netwerkverbinding bij een volgende update verdwijnen. Heb je in stap 2 extra bestaande composebestanden gevonden, behoud die eveneens.

## 8. Controleer de verbinding

**Waar:** op de server; de huidige map maakt niet uit.

Dit controleert alleen of Inventory de Cohvera API intern kan bereiken, zonder de sleutel te tonen:

```sh
docker exec cohvera-inventory python -c 'import urllib.request; print(urllib.request.urlopen("http://cohvera-projects-api:4000/health", timeout=10).read().decode())'
```

Je verwacht een antwoord met `"status":"ok"`. Gebruik de actuele Inventory-containernaam als die veranderd is.

**Daarna in je browser:**

1. Open Inventory via je gebruikelijke adres; meld aan als login ingeschakeld is.
2. Ga naar **Projecten → Project uit Cohvera**.
3. Kies **Tomme Energie** en klik **Projecten zoeken**.
4. Selecteer een project met **Gebruiken**.
5. Vul de lokale materiaaldatum en klaarzetlocatie aan. Het project is daarna te kiezen bij **Bestellingen**.

Deze zoekactie test ook de sleutel en bedrijfsrechten. Een succesvolle healthcheck alleen bewijst die nog niet.

## Als iets niet werkt

| Melding/situatie | Controle |
| --- | --- |
| `No such container` | Controleer de huidige naam met `docker ps`. |
| Extra composebestand ontbreekt | Beide wijzigingen moeten op GitHub staan en in de juiste serverbranch opgehaald zijn. |
| Netwerk bestaat niet | Voer `docker network create cohvera-warehouse` eenmalig uit. |
| Interne naam niet gevonden / verbinding geweigerd | Start beide applicaties met hun extra composebestand. Controleer of de API gezond is. |
| Koppeling nog niet geactiveerd | Controleer de zes Inventory-instellingen uit stap 6; daarna container opnieuw aanmaken zoals in stap 7. |
| Cohvera weigert verbinding | Controleer of beide sleutels exact gelijk zijn en beide bedrijfslijsten `TOMME` bevatten; het bedrijf moet ook actief zijn in Cohvera. |
| Geen projecten gevonden | Controleer of Cohvera projecten voor het gekozen bedrijf bevat en zoek met een leeg zoekveld. |

Logs van Cohvera:

```sh
cd "$PORTAL_DIR"
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml logs --tail=80 api
```

Logs van Inventory:

```sh
cd "$INVENTORY_DIR"
docker compose -f docker-compose.yml -f docker-compose.cohvera.yml logs --tail=80 inventory
```

Deel bij hulp alleen de relevante foutregels, geen `.env` of sleutels.

## Later uitschakelen of sleutel vervangen

- **Uitschakelen:** zet in Inventory `COHVERA_PROJECTS_ENABLED=0` en voer Inventory's commando's uit stap 7 opnieuw uit. Bestaande lokale projecten blijven beschikbaar.
- **Toegang intrekken aan Cohvera-kant:** maak `WAREHOUSE_PROJECTS_API_KEY` leeg en hermaak de Portal-containers met stap 7.
- **Sleutel vervangen:** genereer één nieuwe sleutel, vervang hem in beide `.env`-bestanden en voer stap 7 opnieuw uit.

De sleutel mag alleen projecten lezen; geen accounts bekijken of projecten wijzigen. De API-poort wordt niet publiek geopend. Alleen de twee applicaties worden aan het extra Docker-netwerk gekoppeld. De verbinding gebruikt intern HTTP; buiten dit vaste Docker-adres vereist Inventory HTTPS.
