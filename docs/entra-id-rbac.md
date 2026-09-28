# Microsoft Entra ID en rechten in Cohvera

## Samenvatting van de implementatienota

Microsoft Entra ID is de ingang: een medewerker meldt zich aan met het zakelijke Microsoft-account. Microsoft past MFA en Conditional Access toe. Cohvera ontvangt een gecontroleerd bewijs van de identiteit en de toegewezen portaalrollen; Cohvera krijgt het Microsoft-wachtwoord niet te zien.

| Groep in Entra | Rol in het token | Betekenis in Cohvera |
| --- | --- | --- |
| Geen van beide portaalgroepen | Geen portaalrol | Geen toegang |
| SG-PORTAL-Users | Portal.User | Gewone portaaltoegang |
| SG-PORTAL-Admins | Portal.Admin | Portaalbeheer én gewone toegang |
| Beide groepen | Beide rollen | Dezelfde beheertoegang |

De bestaande groepen SG-COHVERA-All en SG-COHVERA-Management zijn organisatorische groepen, geen portaalrollen. In de Enterprise Application hoort **Assignment required = Yes** te staan. Een geldig Microsoft-account alleen geeft dus nog geen toegang.

Er zijn twee afzonderlijke vragen:

1. **Mag deze persoon binnen, en mag die het portaal beheren?** Dit bepaalt Entra via bovenstaande rollen.
2. **Voor welke bedrijven en werkzaamheden mag deze persoon gegevens zien of aanpassen?** Dit bepaalt Cohvera via bedrijfstoegang en bedrijfsrollen.

Voorbeeld: iemand met Portal.User kan Manager zijn bij Tomme en Lezer bij Q-Home. Die persoon wordt daardoor geen portaalbeheerder. Alleen Portal.Admin kan accounts/bedrijfstoegang, tools en plugins beheren. Ook Portal.Admin heeft een bedrijfstoewijzing nodig om de operationele dossiers van een bedrijf te openen; beheer van de toewijzingen zelf is wel beschikbaar zonder zo'n toewijzing.

De voorgestelde aanmeldroute is Authorization Code Flow met OpenID Connect. Tokens worden door een onderhouden library gecontroleerd. De vaste combinatie van tenant-ID en object-ID identificeert een persoon; een e-mailadres is veranderlijk. Geen Microsoft Graph-rechten zijn nodig voor deze login en rollencontrole.

## Wat is geïmplementeerd

- `/login`: aanmeldpagina met Microsoft-knop, configuratiestatus en begrijpelijke foutmeldingen.
- `/auth/login`, `/auth/callback`, `/auth/logout`: server-side OIDC-flow met `openid-client` 6, PKCE S256, state, nonce en expliciete JWS-handtekeningcontrole.
- Validatie van issuer, audience, lifetime (incl. not-before), tenant-ID, object-ID en exacte Portal.User/Portal.Admin-waarden. Geen eigen JWT-validator.
- Server-side sessies in PostgreSQL. De browser ontvangt alleen een willekeurige HttpOnly-cookie met SameSite=Lax en Secure bij HTTPS. Alleen een SHA-256-hash van het sessiegeheim staat in de database. Access-/refresh-/ID-tokens worden niet opgeslagen of naar de frontend gestuurd.
- Sessielevensduur standaard 15 minuten, maximaal de ID-tokenlevensduur. Geen stilzwijgende sessieverlenging: opnieuw aanmelden haalt nieuwe rollen op. Entra-groepswijzigingen worden zichtbaar na verversing bij Microsoft en nieuwe aanmelding; dit is geen onmiddellijke groepsrevocatie via Graph.
- Logout trekt de lokale sessie in en verwijst vervolgens naar Microsoft logout. Deactiveren of wijzigen van een lokaal account trekt bestaande sessies in; businessrollen worden bovendien bij elke aanvraag uit de database gelezen.
- Globale API-beveiliging. Alleen health, loginconfiguratie, loginstart en callback zijn openbaar. Geen spoofbare identityheaders of plugin-admin-token als alternatieve beheerroute.
- Origincontrole voor wijzigingen, alleen JSON voor gewone mutaties, `Cache-Control: no-store` en eenmalige aanmeldpogingen van tien minuten.
- Bedrijfstoegang en bedrijfspermissies op de API, ook voor directe URL's en documentdownloads. Geen automatische toegang tot alle bedrijven voor nieuwe accounts.
- Sidebar, bedrijfskieslijst en beheerknoppen volgen de serverrechten. De frontend is aanvullende UX; de API blijft de beveiligingsgrens.
- Caddy en Next.js leiden `/auth/*` door naar de API, zodat de callback exact op het adres uit het document werkt.

## Bestaande accounts en eerste beheerder

Een nieuwe Entra-gebruiker wordt na een geldige login geregistreerd, zonder automatische bedrijfstoegang. Een Portal.Admin kan in **Accounts & rechten** de gewenste bedrijfsrol toewijzen, ook aan zichzelf.

Een bestaand lokaal account wordt nooit automatisch overgenomen op basis van hetzelfde e-mailadres. Koppel zo'n account via **Accounts & rechten → Entra object-ID** aan de object-ID van de gebruiker uit de juiste tenant. De tenant wordt uit de serverconfiguratie genomen. Een bestaande identiteit kan via dit formulier niet worden vervangen.

Koppel vóór activering bij voorkeur het bestaande beheeraccount aan de juiste object-ID, terwijl de expliciete ontwikkelmodus nog werkt en de Entra-configuratie al is ingevuld. Gebruik anders een toegewezen Portal.Admin-account dat nog geen lokaal e-mailadresconflict heeft om het eerste beheer te doen. Geef portaalbeheer via Entra; een databasebedrijfsrol is geen vervanging voor Portal.Admin.

De oude lokale rol `portal-admin` wordt voor bestaande bedrijfstoewijzingen alleen als volledige **bedrijfsrol** behandeld; in Entra-modus verleent die geen portaalbeheer. Nieuwe toewijzingen gebruiken **Bedrijfsbeheerder**. De seed creëert de vaste Remko-identiteit uitsluitend wanneer AUTH_MODE expliciet development is en overschrijft bestaande memberships niet meer.

## Veilige configuratie

Vul deze waarden op de host in de niet-gecommitteerde `.env` in. Kopieer tenant- en client-ID rechtstreeks uit de App Registration; gebruik geen waarden uit voorbeelden.

```dotenv
AUTH_MODE=entra
ENTRA_TENANT_ID=<Directory Tenant ID>
ENTRA_CLIENT_ID=<Application Client ID>
ENTRA_CLIENT_SECRET=<Client secret VALUE>
ENTRA_REDIRECT_URI=https://portal.cohvera.be/auth/callback
ENTRA_SESSION_MINUTES=15
```

Het client secret blijft uitsluitend bij de API. De oudere AZURE_AD_TENANT_ID/CLIENT_ID/CLIENT_SECRET-namen worden als terugval geaccepteerd; gebruik bij voorkeur één set. Zorg voor een rotatieprocedure. Deze implementatie ondersteunt een client secret; certificate/federated credentials uit de voorkeursrichting van de PDF zijn nog geen geïmplementeerde credentialvariant.

Microsoft-configuratie controleren:

- Single-tenant App Registration.
- Web redirect URI exact `https://portal.cohvera.be/auth/callback`.
- Scopes: `openid profile email`; geen Graph-scopes.
- Technische app-role values exact `Portal.User` en `Portal.Admin`.
- Beide security groups aan de juiste rollen koppelen via Enterprise Application.
- Assignment required = Yes; implicit flow/public-client flow uit.
- MFA/Conditional Access toepassen in Entra volgens jullie beleid.
- Voeg zo nodig `https://portal.cohvera.be/login` toe als toegestane post-logout redirect.

Voor lokaal testen met Entra: een afzonderlijk geregistreerde `http://localhost:3000/auth/callback`, WEB_URL=http://localhost:3000 en een niet-productie Node-proces. HTTP-callbacks worden alleen op localhost/127.0.0.1 en buiten NODE_ENV=production toegelaten. Zonder ingevulde Entra-configuratie kan AUTH_MODE=development expliciet worden gebruikt; dit is geen echte login en niet geschikt voor publieke productie.

## Deployment en afhankelijkheden

1. Herstel de DNS A-record `portal.cohvera.be → 84.247.132.149` voordat de publieke callback wordt gebruikt. Bij controle op 28 september gaf de autoritatieve DNS NXDOMAIN terwijl de server met geforceerde hostname wel antwoordde.
2. Vul de beveiligde serverconfiguratie in en controleer de bestaande accountkoppeling.
3. Bouw de gewijzigde images, voer migraties uit en herstart de diensten met de normale deployprocedure. De database krijgt `PortalSession`, `EntraLoginAttempt` en een samengestelde tenant/object-identiteit. De `/auth/*`-routing vereist ook de gewijzigde Caddyfile.
4. Test zonder bestaande sessie, met een gewone gebruiker en met een Portal.Admin. Controleer ook rechtstreeks de API, niet alleen verborgen knoppen.
5. Controleer dat de interface de echte Microsoft-naam toont en geen ontwikkelomgeving meer meldt.

Code alleen kan geen groepslidmaatschappen, App Role assignments, DNS of Microsoft Conditional Access instellen. Die blijven beheerinstellingen buiten deze repository. De lokale credentials waren bij implementatie nog leeg; echte tenant-login is daardoor nog niet end-to-end bevestigd.

## Tests

```bash
pnpm --filter @cohvera/api test:auth
pnpm --filter @cohvera/api typecheck
pnpm --filter @cohvera/web build
```

`AUTH_INTEGRATION_TEST=1` activeert de database/API-test tegen een lokale ontwikkeldatabase. Die start een tijdelijk API-proces, maakt alleen synthetische gebruikers/sessies en ruimt ze daarna op. Gebruik niet de productiedatabase.

Tests omvatten rollen A-D, cryptografisch gesigneerde OIDC-responses en weigering van verkeerde handtekening/issuer/audience/expiry/not-before/state/nonce, bedrijfsafscherming, directe beheer-URL's, verlopen en gedeactiveerde sessies en CSRF. Een geslaagde test met een nagebootste provider is geen bewijs dat de echte Microsoft App Registration correct staat.

Bronnen: aangeleverde Cohvera Portal Entra ID RBAC-nota v1.0 (september 2026), Microsoft ID-token-claimsdocumentatie en de officiële openid-client documentatie.
