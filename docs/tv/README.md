# Tv-scherm in Cohvera

Open **Tools & Solutions → Tv-scherm** of `/projects/tv`. Je blijft aangemeld met Microsoft. De selector bevat uitsluitend je toegankelijke bedrijven; de API controleert `projects.read` per bedrijf. Instellingen wijzigen vereist `projects.manage`.

## Overgenomen werking

- Standaard huidige, actieve Plenion-projecten met `07 - In Uitvoering`, niet afgesloten. Handmatige Cohvera-projecten tellen mee met portaalstatus `Actief`.
- Alternatieve selectie: alle open projecten. Een ontbrekend afsluitvinkje wordt niet als open beschouwd.
- Acht lopende projecten en zes toekomstige projecten per pagina, automatische rotatie (standaard 12 seconden), pauzeren en volledig scherm. Verversen elke 15 seconden.
- Planning verstreken / vandaag of ongepland / toekomstig, plus twaalf maanden vooruit. De bronplanning is geen nieuwe deadline op de gewone projectenpagina.
- Voertuigen en keuringen: rood binnen één kalendermaand of overtijd/ontbrekend, oranje binnen drie maanden, anders groen. Jaaroverzicht en rotatie bij meer dan zes voertuigen.
- Een gedeelde afvalkalender per bedrijf met expliciete ophaaldatums en herinnering op de dag ervoor. De oude vaste Tomme-datums worden niet automatisch aan andere bedrijven toegekend. Vul bevestigde datums in via Instellingen; er is geen koppeling met de afvalvervoerder.
- Optionele NAS-metingen met CPU, RAM, schijf, I/O en maximaal 400 meetpunten van de bron voor de 24-uurgrafiek. Geen nieuwe NAS-monitoringdaemon: de bestaande read-only monitor wordt gebruikt.

Bron: aangeleverde `projecten-tv`-map. De oude losse site blijft ongewijzigd. Productie-JSON, voertuignummers en klantgegevens worden niet in Git opgenomen.

## 1. Portal-server: code, database en web bijwerken

Zet de lokale wijzigingen eerst in een commit en push ze naar GitHub. Daarna **op de Portal-server**:

```sh
cd /root/Portal
git status
git fetch origin
git merge --no-ff origin/main
```

Bij een conflict: eerst oplossen; niet verder bouwen. Behoud je `.env` en compose-overrides. Maak een databasebackup volgens jullie deploymentprocedure. Bouw vervolgens de volledige applicatie, met het bestaande Warehouse-netwerk:

```sh
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml logs --tail=40 migrate
```

Migratie `20261006140000_company_tv` maakt één bedrijfsgebonden tabel voor instellingen en de laatste aanvullende tv-brondata. De eerdere migratie voor Plenion-statusvelden is eveneens vereist.

Projecten werken zodra de bestaande projectimport werkt. Voor de aanvullende widgets volg je stap 2.

## 2. Q-box: voertuigen en optioneel NAS doorsturen

**Vanaf je Mac:**

```sh
scp /Users/milansaelens/Development/cohvera/qbox-connector/qbox_sync.py loxberry@192.168.10.78:/tmp/qbox_sync.py
ssh loxberry@192.168.10.78
```

**Op de LoxBerry:**

```sh
sudo systemctl stop cohvera-qbox
sudo install -m 644 /tmp/qbox_sync.py /opt/cohvera-qbox/qbox_sync.py
sudo nano /etc/cohvera-qbox/qbox.env
```

Voeg toe of werk bij, behoud alle overige waarden en je bestaande importsleutel:

```dotenv
QBOX_SOURCE_MODE=datahub
QBOX_DATAHUB_URL=http://192.168.10.228:3210
QBOX_SOURCE_URL=http://www.tomme-energie.lan/projecten-tv
QBOX_TV_ENABLED=1
QBOX_NAS_URL=http://www.tomme-energie.lan/ai/api/nas/monitor
```

De NAS-URL komt uit de aangeleverde schermcode. Bereikbaarheid zonder browsersessie moet vanaf de Q-box worden bevestigd. Laat `QBOX_NAS_URL` leeg als die bron niet beschikbaar is. Hiervoor worden geen browsercookies of extra credentials gekopieerd.

Test en start, **nog steeds op de LoxBerry**:

```sh
sudo sh -c 'set -a; . /etc/cohvera-qbox/qbox.env; set +a; python3 /opt/cohvera-qbox/qbox_sync.py --dry-run'
sudo sh -c 'set -a; . /etc/cohvera-qbox/qbox.env; set +a; python3 /opt/cohvera-qbox/qbox_sync.py --once --force'
sudo systemctl start cohvera-qbox
sudo journalctl -u cohvera-qbox -n 40 --no-pager
```

Ook na een fout de service opnieuw starten. De dry-run leest de bronnen maar test geen serveropslag. De projectimport en tv-import zijn aparte verzoeken: mislukte tv-aanvoer draait een geslaagde projectimport niet terug. Aanvullende tv-data wordt iedere poll verstuurd (standaard 60 seconden), ook als de projecten niet gewijzigd zijn. Upload gaat uitsluitend via HTTPS met dezelfde Q-box-sleutel.

**Bedrijfsindeling:** zowel projecten als tv-bronnen volgen `QBOX_IMPORT_COMPANY` op de Portal-server. Bij jullie staat dat voorlopig op `QHOME`, hoewel de bron Tomme is. Dit is één bron/doelbedrijf per serverconfiguratie; het toevoegen van meerdere onafhankelijke Q-boxen voor verschillende bedrijven vereist aparte sleutel-naar-bedrijfskoppelingen. De tv-weergave en instellingen zijn al geschikt voor alle bestaande bedrijven, maar kopiëren nooit automatisch Tomme-voertuigen naar andere bedrijven.

## Actualiteit

‘Cohvera verbonden’ betekent dat de browser de Cohvera-API bereikt, niet dat Plenion realtime is. De werkelijke Plenion-bronstand staat ernaast. Projecten ouder dan 24 uur of afwezig uit de laatst geïmporteerde bronstand worden verborgen. Verbindingsuitval verbergt de projectlijst. Voertuigen vereisen een verse bronstand én hetzelfde snapshot als de projectimport. NAS-cijfers vereisen een meting van maximaal drie minuten oud en bevestigde logging. Ontbrekende bronnen worden niet vervangen door voorbeeldgegevens.

Instellingen zijn gedeeld per bedrijf. De browserkeuze van het actieve bedrijf blijft een accountkeuze; het wijzigen daarvan verruimt geen rechten. Een verlopen Microsoft-sessie leidt naar de bestaande loginpagina.

## Verificatie

```sh
pnpm db:generate
pnpm --filter @cohvera/api typecheck
pnpm --filter @cohvera/web exec tsc --noEmit --incremental false
pnpm --filter @cohvera/api exec tsx --test src/tv.test.ts src/integrations/qbox.test.ts ../web/lib/tv.test.ts
# Connector-tests in de aparte repository:
cd ../qbox-connector
python3 -m unittest discover -s . -p 'test_*.py'
```

UI-controle gebeurt lokaal met fictieve API-antwoorden. De PostgreSQL-migratie en live Q-box/NAS-aanvoer moeten na deployment op de echte omgeving worden gecontroleerd.
