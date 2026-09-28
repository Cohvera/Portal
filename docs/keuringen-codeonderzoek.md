# Keuringen: codeonderzoek en integratievoorstel

Onderzocht op 25 september 2026: lokale kopieën `tomme-keuringen-source` en `keuringen-server` onder `/Users/milansaelens/Development/tomme`. Dit is een broncodeonderzoek, geen volledige functionele acceptatietest of verificatie van de live deployment. Geen productiegegevens gewijzigd en geen mails verstuurd.

## Conclusie

De bestaande toepassing bevat veel herbruikbare werking. Behoud aanvankelijk de NAS-backend en documentopslag en bouw de schermen stapsgewijs in de Cohvera-shell. Een volledige herschrijving of onmiddellijke databaseverhuizing vergroot het risico zonder dat dit nodig is voor een consistente gebruikerservaring.

## Bevindingen

| Onderdeel | Bevinding | Gevolg |
| --- | --- | --- |
| Interface | React 19/Vite, Tailwind en Leaflet. `src/App.jsx` bevat 3.719 regels met schermen, API-verzoeken, workflowregels en toestand. | React is herbruikbaar, maar eerst opsplitsen. Browserglobals zoals `window` op moduleniveau zijn niet direct geschikt voor Next.js serverrendering. |
| Backendversies | De backend in de broncodemap telt 938 regels; de aparte backend 1.385. Deze laatste heeft 18 extra route/methode-combinaties, onder meer periodieke documenten, dossierbewerking, bewijsvergrendeling en voorplanningsmail. | Niet blind de backend uit de broncodemap deployen. Eerst bepalen welke versie live draait en één canonieke bron vastleggen. |
| Opslag | JSON-bestanden (`state.json`, `dossiers.json`), uploadmappen, backups en externe NAS-projectmappen. Geen relationele database als primaire dossieropslag. | Bewaar deze opslag tijdens de eerste integratiefase. Later pas migreren met controle van dossier-ID’s, documenten, cycli en historie. |
| Gelijktijdig werken | `/api/state` schrijft de volledige toestand. Versiecontrole bestaat, maar ontbrekende `baseVersion` wordt toegestaan en `forceOverwrite` omzeilt de conflictcontrole. | Voor betrouwbaar gedeeld gebruik versiecontrole verplicht maken en wijzigingen per dossier/cyclus verwerken. |
| Identiteit en rechten | De identity-adapter kent een centrale sessie of handmatig opgegeven gastnaam. In de onderzochte backend ontbreekt algemene afdwinging van Cohvera-bedrijfsrechten; uploads worden statisch aangeboden. | Bestaande identiteit is geen Cohvera-autorisatie. Rechten moeten server-side worden gecontroleerd, ook bij bestanden, mails, verwijderen en herstel. Eventuele NAS-proxybeveiliging is niet onderzocht. |
| Koppelingen | `/keuringen` als API-basis, interne hostfallback, NAS-paden, `tomme-folder://` en centrale identity/audit-adapters. | Maak adressen configureerbaar. Een publiek gehost Cohvera kan de NAS niet automatisch bereiken: kies een private netwerkverbinding of gecontroleerde gateway. |
| Cohvera-plugin | De huidige inspections-plugin bevat registratie, route en vereiste permissienamen; geen implementatie van de keuringsworkflow. | De bestaande demonstratieschermen vormen geen vervanging voor de echte app. |
| Tests | De bestaande test voor periodieke herinboekregels slaagt. `approved-fixes.test.cjs` stopt op een hardgecodeerd `Y:\\tomme-energie-data\\keuringen-server\\server.cjs`-pad. | Testpaden overdraagbaar maken. De laatste suite voert broncodepatrooncontroles uit; deze bewijzen geen end-to-end werking. |

## Wat behouden

- Dossiers, keuringsrondes, routes en voorbereiding.
- Periodieke keuringen, herkeuringen, cyclusidentificatie en dubbele-aanvraagcontrole.
- Bewijsstukken, projectmapkoppelingen, vergrendelingen en historie.
- Uploads, PDF/ZIP-export en bestaande mailflows, met de huidige bevestigingen.

## Uitvoering in volgorde

1. Canonieke frontend/backend vastleggen; testomgeving met synthetische dossiers, tijdelijke uploadmappen en uitgeschakelde externe mail opzetten. Bestaande tests overdraagbaar maken.
2. API-contracten en een Cohvera-adapter definiëren. NAS-bereikbaarheid, bedrijfscontext, autorisatie en documenttoegang expliciet regelen. De eerdere keuze om echte login terug te draaien blijft gelden; definitieve identiteit vraagt een afzonderlijke ontwerpkeuze.
3. Een eerste complete flow in Cohvera bouwen: overzicht → dossier → documenten → status. Gedeelde sidebar, componenten en foutmeldingen gebruiken.
4. Periodiek, rondes/kaart, exports en mails overzetten met regressiecontrole op de bestaande bedrijfsregels.
5. Pas daarna opslag per dossier verbeteren of migreren naar PostgreSQL, met herstelprocedure en gegevensvergelijking.

## Acceptatie voor de eerste flow

Een Tomme-dossier is binnen de Cohvera-shell raadpleegbaar en bewerkbaar; onbevoegde toegang wordt ook via de API geweigerd; een versieconflict overschrijft geen gegevens; bestaande documenten blijven bereikbaar; niets verstuurt mail zonder expliciete actie. Vergelijk dit in een geïsoleerde testomgeving met de bestaande app voordat productie wordt omgezet.

De eerdere globale dag-/weekinschatting is nog geen betrouwbare planning. De omvang hangt vooral af van hoeveel flows direct moeten overgaan en welke identity/netwerkoplossing wordt gekozen. De eerste afgebakende flow is de juiste basis voor een verdere raming.
