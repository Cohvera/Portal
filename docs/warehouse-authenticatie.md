> Voor de eenvoudige verbinding op dezelfde server, zonder nieuwe Entra-rol: zie [Warehouse API-sleutel](warehouse-api-sleutel.md). Onderstaande Entra-methode is een alternatief.

# Warehouse verbinden met de Cohvera-project-API

De Cohvera-API ondersteunt nu Entra v2 access tokens voor applicaties. Alleen de read-only projectreferenties onder `/api/v1/companies/{code}/projects` zijn beschikbaar voor deze identiteit. Gebruikers blijven met hun normale portaalsessie werken. Er wordt geen lokaal Warehouse-gebruikersaccount aangemaakt.

## 1. De API registreren in Entra

Gebruik bij voorkeur een aparte single-tenant **App-registratie**, bijvoorbeeld `Cohvera Project API`. Dit houdt de bestaande interactieve Cohvera-aanmelding gescheiden. Noteer de **Toepassings-id (client)** en gebruik dezelfde tenant als het portaal.

- Onder **Een API beschikbaar maken**: stel de toepassings-id-URI in op `api://<API-client-ID>`.
- Onder **App-rollen → App-rol maken**:
  - Weergavenaam: `Projecten lezen`
  - Toegestane lidtypen: **Toepassingen**
  - Waarde: **`Projects.Read.All`** (exact)
  - Beschrijving: `Projecten lezen voor door Cohvera toegestane bedrijven`
  - Ingeschakeld: ja.
- In **Manifest**: zet `api.requestedAccessTokenVersion` op **2**. Behoud de andere velden binnen `api`.
- Voeg bij `optionalClaims.accessToken` onderstaande claim toe. Behoud andere claims:

```json
{"name":"idtyp","source":null,"essential":false,"additionalProperties":[]}
```

Voor deze API-app is geen redirect-URL of client secret nodig: zij controleert tokens met de openbare Microsoft-sleutels. De app-role naam betekent niet dat Warehouse automatisch alle bedrijven krijgt; de serverconfiguratie beperkt de bedrijven per aanroepende applicatie.

## 2. Warehouse registreren en toestemming geven

Maak een aparte single-tenant **App-registratie**, bijvoorbeeld `Warehouse Connector`.

1. **API-machtigingen → Een machtiging toevoegen → Mijn API's → Cohvera Project API**.
2. Kies **Toepassingsmachtigingen → Projects.Read.All**.
3. Verleen **beheerderstoestemming** voor de tenant.
4. Gebruik een certificaat of maak een client secret bij **Certificaten en geheimen**. De geheime waarde hoort uitsluitend in de beveiligde Warehouse-backendconfiguratie. Deel geen secret via chat of Git.

Gebruik hiervoor niet de interactieve portaalclient. Warehouse meldt zich aan als toepassing; er zijn geen Portal.User/Portal.Admin-groepen nodig voor de connector.

## 3. Cohvera-serverconfiguratie

Vul in de bestaande `.env` van Cohvera (vervang de aanduidingen door echte UUID's):

```dotenv
ENTRA_API_AUDIENCE=<client-ID-van-Cohvera-Project-API>
ENTRA_SERVICE_CLIENTS='{"<client-ID-van-Warehouse-Connector>":["TOMME"]}'
```

De bestaande `ENTRA_TENANT_ID` bepaalt de toegestane tenant. `ENTRA_API_AUDIENCE` is de **UUID**, niet `api://...`, want deze implementatie valideert v2 access tokens. De allowlist bepaalt exact welke applicatie welke bedrijven mag lezen. Mogelijke bedrijfscodes zijn `COH`, `QHOME`, `TOMME`, `WARCO`. Geef alleen de benodigde bedrijven op. Leeg of `{}` staat geen client toe; `*` is niet toegestaan.

Push/deploy de code en bouw de API opnieuw met de normale deployprocedure. Voor alleen gewijzigde `.env`-waarden na deployment:

```bash
docker compose up -d --no-deps --force-recreate api
```

Er is geen nieuwe databasemigratie voor applicatie-authenticatie. De eerder toegevoegde projectmigratie blijft wel vereist voor projecten aanmaken door medewerkers.

## 4. Warehouse-backend

Laat de backend via een onderhouden Microsoft-authenticatiebibliotheek (bijvoorbeeld MSAL) een client-credentials-token ophalen:

- Tokenadres: `https://login.microsoftonline.com/<tenant-ID>/oauth2/v2.0/token`
- `grant_type`: `client_credentials`
- `client_id`: client-ID van Warehouse Connector
- Credential: certificaat of Warehouse client secret
- `scope`: `api://<API-client-ID>/.default`

Gebruik het ontvangen **access_token**, nooit een ID-token. Bewaar/cache het uitsluitend op de server tot vlak voor expiratie. Haal dan een nieuw token op. Stuur het via HTTPS in de header:

```http
GET /api/v1/companies/TOMME/projects HTTP/1.1
Host: portal.cohvera.be
Authorization: Bearer <access_token>
```

Projectkeuze, tokenaanvraag en HTTP-client in Warehouse moeten nog worden aangesloten. Warehouse moet zelf bepalen welke ingelogde gebruikers de opgehaalde gegevens mogen zien: een applicatietoken vertegenwoordigt de backend, niet de individuele gebruiker.

## Validatie en fouten

De API controleert RS256-handtekening, Microsoft-issuer, audience, exp/nbf, tenant, `ver=2.0`, `idtyp=app`, afwezigheid van gedelegeerde `scp`, `azp` (Warehouse client-ID), de exacte app-role en de lokale bedrijvenallowlist. De sleutels komen uitsluitend van de vaste Microsoft-URL voor de geconfigureerde tenant. Tokeninhoud of secrets worden niet gelogd.

- 200: projecten opgehaald.
- 401: ongeldig/verlopen token, verkeerd token-type, issuer, audience of tenant.
- 403: geldige applicatie zonder rol/allowlist, verkeerd bedrijf, inactief bedrijf of een ander endpoint/schrijfactie.
- 404: project bestaat niet binnen dat bedrijf, of route bestaat niet.
- 503: ontbrekende of ongeldige serviceconfiguratie.

Een fout Bearer-token valt nooit terug op een browsercookie of ontwikkelidentiteit. Het verwijderen van een client uit `ENTRA_SERVICE_CLIENTS` en opnieuw aanmaken van de API-container trekt de toegang in, ook voor nog niet verlopen tokens. Entra-permissiewijzigingen alleen kunnen nog geldig uitgegeven tokens laten doorwerken tot expiratie.

De lokale tests gebruiken ondertekende synthetische tokens en controleren de echte HTTP-routes met een nagebootste Microsoft-keyserver. De echte tenant/credentials moeten na configuratie nog worden getest.

Bronnen: [Microsoft client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow), [Microsoft claimvalidatie](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).
