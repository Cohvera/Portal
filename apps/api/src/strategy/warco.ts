import type { StrategyDefinition } from "@cohvera/contracts";
// Source: Operationeel Plan - Roadmap 5Y.pdf, pages 4–11. Phase 5 includes years 4–5.
export const warcoActions: StrategyDefinition[] = [
  {
    "id": "J1-01",
    "phase": "1",
    "title": "Stockrotatie en cashflow verbeteren",
    "description": "Meet stockrotatie en identificeer voorraad die langer dan 90 dagen blijft liggen. Scheid projectstock van algemene voorraad. Meet de tijd tussen aankoop, inzet en betaling door de klant. Werk overtollige voorraad weg en stem bestellingen en materiaalfacturatie af op de projectplanning.",
    "result": "Voorraadrapport met >90-dagenlijst, projectstock en betaalmomenten; concrete afbouwacties.",
    "amount": "€150k; focus cashflow."
  },
  {
    "id": "J1-02",
    "phase": "1",
    "title": "Magazijn digitaliseren",
    "description": "Selecteer en voer een eenvoudig barcode-/WMS-light-systeem in voor voorraadbewegingen. Leg eigenaarschap bij de magazijnier. Onderzoek slimme camera’s met AI voor stockcontrole; houd het proces eenvoudig en gericht op betrouwbare data.",
    "result": "Voorraadbewegingen worden gescand en stockgegevens zijn bruikbaar voor J1-01.",
    "amount": "€100k."
  },
  {
    "id": "J1-03",
    "phase": "1",
    "title": "Centrale aankoopstrategie",
    "description": "Breng gemeenschappelijke leveranciers van Warco, Q-Home en Tomme samen. Onderhandel groepsraamcontracten; laat elke operationele unit bestellen aan de overeengekomen groepsvoorwaarden.",
    "result": "Leveranciersoverzicht, raamcontracten en prijsafspraken beschikbaar voor de units.",
    "amount": "€50k."
  },
  {
    "id": "J1-04",
    "phase": "1",
    "title": "Magazijn en ventilatieberekening versterken",
    "description": "Werk een gecombineerde functie uit voor magazijnbeheer, materiaal klaarzetten, bestellingen, leveringsopvolging, ventilatieberekening en metingen. Voorzie opleiding. Stem bezetting af op de integratie van Q-Home en Tomme. Bestel projectmateriaal op tijd, zonder onnodig vroege levering.",
    "result": "Installateurs zijn ’s morgens maximaal 15 minuten in het magazijn; materiaal en werkinstructies liggen klaar.",
    "amount": "€75k."
  },
  {
    "id": "J1-05",
    "phase": "1",
    "title": "Offertes en technische uitwerking versnellen",
    "description": "Verminder de afhankelijkheid van de zaakvoerder. Moderniseer de Access-aanpak voor warmteverliesberekening naar een cloudtoepassing, in samenhang met ventilatieberekening en de gestandaardiseerde offertegegevens in Plenion. Laat een junior technisch tekenaar voorbereiden; projectleider of unitmanager controleert vóór verzending. Behoud de expertise in-house.",
    "result": "Vaste werkverdeling, controlepunt en meetbare offertedoorlooptijd. Het plan vermeldt verwachte projectstart 6–8 maanden na goedkeuring, geen offerte-SLA.",
    "amount": "€75k–€200k."
  },
  {
    "id": "J1-06",
    "phase": "1",
    "title": "Teken-team opstarten en Q-Home integreren",
    "description": "Bundel de tekenfunctie met Q-Home. Standaardiseer digitale legplannen, detailtekeningen en werfuitzetting voor de groep. Laat de tekenfunctie op termijn aansluiten op projectopvolging en onderzoek een engineeringfee in offertes.",
    "result": "Gezamenlijke tekenstandaard, gedeelde capaciteit en bruikbare uitvoeringsplannen.",
    "amount": "€25k."
  },
  {
    "id": "J1-07",
    "phase": "1",
    "title": "Totaalprojecten aanbieden",
    "description": "Neem elektriciteit, laadpalen en zonnepanelen structureel mee naast HVAC. Richt de propositie op kwaliteit, ontzorging en meerwaarde, vooral bij kleinere bouwfirma’s. Gebruik de gestandaardiseerde tekenaanpak.",
    "result": "Vast totaalprojectaanbod en opvolging van ticketwaarde en marge.",
    "amount": "€10k–€100k."
  },
  {
    "id": "J1-08",
    "phase": "1",
    "title": "Kostprijs en marge per project zichtbaar maken",
    "description": "Laat het planningsteam inkomende facturen in Billit per project taggen. Combineer verwachte opbrengsten uit Plenion met uitgaande facturatie en voorspellingen uit Billit. Bespreek risicoprojecten in de maandelijkse service review. Bouw vervolgens projectopvolging met werf-/projectleiders verder uit.",
    "result": "Rapport per project: omzet; materiaal, techniekeruren en onderaanneming; toegewezen projectleiding, magazijn/logistiek en overhead; brutomarge en netto projectmarge.",
    "amount": "Geen bedrag genoemd."
  },
  {
    "id": "J1-09",
    "phase": "1",
    "title": "Calculatie- en normtijdmodellen valideren",
    "description": "Controleer bestaande Plenion-modellen via nacalculatie en actualiseer elke drie maanden. Bouw een verkoopkostprijsmodel met materiaal, normuren × uurkost, onderaanneming, overhead, risico en marge, plus normtijdmodellen per projecttype (o.a. ventilatie per m² en HVAC per type). Benchmark de markt; geef efficiëntiewinst niet automatisch weg via lagere verkoopprijzen.",
    "result": "Kwartaalreview en vergelijking calculatie versus werkelijkheid voor materiaal, uren en marge. De voorbeeldcijfers in de PDF zijn illustratief, geen gemeten Warco-resultaten.",
    "amount": "€5k–€20k."
  },
  {
    "id": "J1-10",
    "phase": "1",
    "title": "ERP-basis leggen",
    "description": "Begin met stock, groepsconsolidatie en integratie van calculaties in de groeps-ERP. Start nacalculatie en minimale tijdsregistratie. Stem de invoering af op magazijndigitalisatie en projectrapportering.",
    "result": "Afgebakende basisinrichting en bruikbare stock-, uren- en nacalculatiegegevens.",
    "amount": "Geen bedrag genoemd."
  },
  {
    "id": "J1-11",
    "phase": "1",
    "title": "Onderhoudsteam opstarten",
    "description": "Gebruik de Warco-klantendatabase in Plenion en de gegevens van Tomme-Energie om proactief onderhoud te boeken. In het plan: eerst Bruno, later in combinatie met Yves; inzet nog bevestigen. Groepeer afspraken geografisch. Contacteer de klant, plan het bezoek, bevestig de dag voordien inclusief kosten, voer onderhoud uit en laat direct mobiel betalen met ondertekend onderhoudsattest.",
    "result": "Groei van 2 naar 20 onderhoudsbeurten per maand (circa 1 per dag), met planning-, betaal- en attestproces.",
    "amount": "€14k–€40k."
  },
  {
    "id": "J1-12",
    "phase": "1",
    "title": "Boekhouding centraliseren",
    "description": "Bereid overdracht naar Admin4All voor met behoud van de digitale Billit-werking. Bekijk na integratie van Q-Home en Tomme verdere opname in de backoffice bij uitbreiding van planning en assistentie.",
    "result": "Afspraken, overdracht en jaarlijkse kost vastgelegd. Bron noemt huidige kost €16.000/jaar en beoogd €5.000/jaar inclusief neerlegging.",
    "amount": "€10k in de titel; verschil tussen genoemde jaarkosten is €11k. Te valideren."
  },
  {
    "id": "J1-13",
    "phase": "1",
    "title": "Sociaal secretariaat consolideren",
    "description": "Werk een groepsgestuurd full-service-model uit voor payroll, afwezigheden en sociaal secretariaat. Borg de overdracht om persoonsafhankelijkheid te verminderen.",
    "result": "Dienstverlening, taakverdeling en budget vastgelegd; bron voorziet ongeveer €50 per persoon per maand.",
    "amount": "−€12k volgens het plan; aard en periode nog te bevestigen."
  },
  {
    "id": "J23-01",
    "phase": "23",
    "title": "Standaardpakketten en projecttemplates ontwikkelen",
    "description": "Ontwikkel HVAC-bundels en pakketten voor solar + batterij + sturing. Zet herbruikbare projecttemplates op en standaardiseer installatietijden. Bouw voort op de teken- en normtijdmodellen uit Jaar 1.",
    "result": "Doel uit de bron: 80% van de projecten template-based. Volg het aandeel templateprojecten en afwijkingen op normtijden.",
    "amount": null
  },
  {
    "id": "J23-02",
    "phase": "23",
    "title": "Pricing en marges per segment sturen",
    "description": "Voer een pricingstrategie in met marges per segment: residentieel, B2B en kleine KMO. Ontwikkel upsellbundels en gebruik projectnacalculatie als feedback.",
    "result": "Prijs- en margeafspraken per segment vastgelegd; doelmarges nog te bepalen.",
    "amount": null
  },
  {
    "id": "J23-03",
    "phase": "23",
    "title": "Engineering-first invoeren",
    "description": "Werk projecten technisch uit vóór uitvoering, met gestandaardiseerde plannen en een duidelijke overdracht naar de werf.",
    "result": "Minder fouten en werfverlies; voorgestelde meetpunten: hersteluren en afwijkingen ten opzichte van de voorbereiding.",
    "amount": null
  },
  {
    "id": "J23-04",
    "phase": "23",
    "title": "ERP uitbreiden met planning en stockintegratie",
    "description": "Breid de ERP-basis uit met planning en geïntegreerde stockopvolging. Verbind capaciteit, materiaalbeschikbaarheid en projectuitvoering.",
    "result": "Planning en stockintegratie operationeel; betrokken teams gebruiken dezelfde projectgegevens.",
    "amount": null
  },
  {
    "id": "J23-05",
    "phase": "23",
    "title": "Dashboard voor project- en ploegrendement",
    "description": "Maak een dashboard met marge per project en rendement per ploeg. Spreek definities, gegevensbron en bespreking af.",
    "result": "Dashboard beschikbaar en bruikbaar in de periodieke opvolging; streefwaarden nog te bepalen.",
    "amount": null
  },
  {
    "id": "J23-06",
    "phase": "23",
    "title": "Rollen scheiden en projectleiding invoeren",
    "description": "Maak sales, engineering en uitvoering afzonderlijk verantwoordelijk voor hun deel van het proces. Voer projectleiders in en leg overdrachtsmomenten vast.",
    "result": "Rolverdeling en verantwoordelijkheden duidelijk; projecten hebben een aangewezen projectleider.",
    "amount": null
  },
  {
    "id": "J23-07",
    "phase": "23",
    "title": "Teken-team als zelfstandige dienstverlening uitbouwen",
    "description": "Maak het teken-team een kernactiviteit die met de hele groep wordt meeverkocht. Richt de werking en vergoeding zo in dat het team zichzelf kan bedruipen.",
    "result": "Eigen inkomsten en kosten zichtbaar; zelfbedruipend teken-team als doel uit de bron.",
    "amount": null
  },
  {
    "id": "J23-08",
    "phase": "23",
    "title": "Onderhoudscontracten opschalen",
    "description": "Schaal onderhoudscontracten voor HVAC, laadpalen en energiebeheer op. Bouw voort op het onderhouds-, plannings- en betaalproces uit Jaar 1.",
    "result": "Contracten per dienst beschikbaar; voorgestelde opvolging: actieve contracten, terugkerende omzet en capaciteit. Aantallen nog te bepalen.",
    "amount": null
  },
  {
    "id": "J23-09",
    "phase": "23",
    "title": "Remote monitoring uitwerken",
    "description": "Werk monitoring op afstand uit als aanvulling op onderhoud en energiebeheer. Bepaal aanbod, technische invulling en wie meldingen opvolgt.",
    "result": "Monitoringaanbod en opvolgproces operationeel; bereik en doelwaarden nog te bepalen.",
    "amount": null
  },
  {
    "id": "J5-01",
    "phase": "5",
    "title": "Hybride businessmodel uitbouwen",
    "description": "Combineer projecten, terugkerende dienstverlening en energiebeheer. Stuur de commerciële focus naar grotere projecten met kleinere bouwfirma’s en minder kleine jobs met lage marge.",
    "result": "Project- en dienstenmix sluit aan op het hybride model; criteria voor projectselectie vastleggen.",
    "amount": null
  },
  {
    "id": "J5-02",
    "phase": "5",
    "title": "Winstgevendheid per klanttype en product sturen",
    "description": "Maak marge per type klant en per product zichtbaar. Beoordeel slecht renderende activiteiten en besluit welke worden verbeterd of geschrapt.",
    "result": "Rendabiliteitsrapport en gedocumenteerde keuzes per activiteit; margedrempels nog te bepalen.",
    "amount": null
  },
  {
    "id": "J5-03",
    "phase": "5",
    "title": "Offertes en plannen verder automatiseren",
    "description": "Voer semi-automatische offertegeneratie en standaardplannen verder door, op basis van gevalideerde calculaties en templates uit eerdere fasen.",
    "result": "Herhaalbaar offerte- en tekenproces; voorgestelde opvolging: doorlooptijd, correcties en manuele bewerkingen.",
    "amount": null
  },
  {
    "id": "J5-04",
    "phase": "5",
    "title": "Prefab en voorassemblage in magazijn invoeren",
    "description": "Bepaal welke onderdelen vooraf in het magazijn kunnen worden samengesteld en organiseer voorbereiding, materiaal en kwaliteitscontrole.",
    "result": "Voorassemblage wordt toegepast waar zinvol; voorgestelde opvolging: totale voorbereidingstijd, montagetijd en fouten.",
    "amount": null
  },
  {
    "id": "J5-05",
    "phase": "5",
    "title": "Synergie met Q-Home en Tomme maximaliseren",
    "description": "Neem energiebeheer mee bij elke installatie. Verdiep HVAC-kennis via Tomme en laat Warco uitvoeren met senior controle. Leg de samenwerking en kwaliteitsborging vast.",
    "result": "Energiebeheer structureel onderdeel van het aanbod; uitvoering door Warco met georganiseerde senior controle.",
    "amount": null
  },
  {
    "id": "J5-06",
    "phase": "5",
    "title": "Cross-selling in de groep organiseren",
    "description": "Maak doorverwijzing en gezamenlijke verkoop tussen Warco, Tomme en Q-Home een vaste werkwijze.",
    "result": "Voorgestelde opvolging: doorverwezen kansen, gezamenlijke offertes en gerealiseerde groepsomzet; doelen nog te bepalen.",
    "amount": null
  },
  {
    "id": "J5-07",
    "phase": "5",
    "title": "Terugkerende omzet naar 15–20% brengen",
    "description": "Bouw onderhoud en monitoring uit tot een stabiele cashflowbron. Verbind contractverkoop, dienstverlening en opvolging met het hybride businessmodel.",
    "result": "Doel uit de bron: 15–20% van de omzet is recurring. Voorgestelde berekening: terugkerende omzet / totale omzet, met afgesproken definitie en meetperiode.",
    "amount": null
  }
];
