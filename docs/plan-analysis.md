# Plananalyse (lokale eerste versie)

Route: `/tools/plan-analysis`. Beschikbaar in Tools & Solutions, inclusief bedrijfstoewijzing door de portaalbeheerder.

## Gegevensverwerking

- PDF.js draait in de browser met een lokale worker, CMaps, fonts en WASM-bestanden. Geen CDN, AI-dienst, API-sleutel of plan-upload.
- Maximaal 20 MB / 30 pagina's. Geen serveropslag; een refresh of navigatie verliest de huidige sessie.
- De gebruiker downloadt resultaten als JSON. Het document zelf wordt niet opgenomen. Een opgeslagen analysesessie heropenen is nog niet ondersteund.
- De bestaande Portal-sessie en catalogus blijven hun normale API-verzoeken gebruiken; die bevatten geen planinhoud.

## Mogelijkheden en grenzen

1. Tekstvermeldingen herkennen in de categorieën oppervlaktes/ruimtes, elektriciteit, verwarming/ventilatie en sanitair.
2. Opgegeven oppervlaktes, U-waarden en aantallen alleen uit expliciete tekst overnemen. Bouwkundige afmetingen worden niet uit elektrische maatlijnen afgeleid.
3. Bronpagina en tekstpositie tonen; controle blijft bij de gebruiker. Legenda's en nota's zijn geen geïnstalleerde aantallen. Herhaalde of verwante vermeldingen worden niet automatisch opgeteld.
4. Een gekende afstand met twee punten kalibreren, per pagina. Binnencontouren met een polygonale lijn meten. Kruisende contouren worden geweigerd. Dit corrigeert geen perspectiefvervorming.
5. Symbolen handmatig met stippen tellen of lokaal voorstellen laten zoeken op basis van één voorbeeldsymbool. Kies twee hoeken rond het voorbeeld en daarna een zoekgebied zonder legenda. De zoeker vergelijkt vorm en eventueel kleur, met schaalvarianten 85/100/115% en optionele kwartslagen. Controleer voorstellen en bevestig ze voordat ze meetellen. Onjuiste punten kunnen worden verwijderd; gemiste symbolen handmatig toegevoegd. Elke klik is één telling; de gebruiker bepaalt of een dubbel stopcontact één combinatie of twee aansluitingen voorstelt.
6. Alleen bevestigde gemeten ruimtes exporteren naar warmteverlies-JSON. Vloeroppervlakte en bron gaan mee; hoogte is 0 en bouwdelen ontbreken, zodat de calculator geen volledig resultaat toont voordat ontbrekende gegevens zijn ingevuld. Temperatuurstartwaarden en luchtverliezen moeten worden gecontroleerd.

Geen algemene AI-planinterpretatie, OCR, normcontrole, U-waarde-afleiding of volledige meetstaat. Voorbeeldherkenning werkt per pagina en kent de betekenis van symbolen niet; gelijkenisscores zijn geen betrouwbaarheidskansen. Overlappende lijnen, scans, afwijkende schaal of subtiele verschillen tussen symbolen kunnen foutieve of ontbrekende voorstellen geven. Maximaal 500 voorstellen per zoekopdracht, met een lokale worker en een tijdslimiet van 60 seconden. Scans kunnen handmatig worden gemeten/geteld.

## Build

`pnpm --filter @cohvera/web build` kopieert PDF.js-assets vanuit de vastgelegde dependency naar `public/pdfjs`, waarna Next bouwt. Deze gegenereerde assets worden niet in Git bijgehouden; ze komen via de bestaande Docker-build in de runtime. De API bevat alleen registratie van het nieuwe tool-ID voor bedrijfstoewijzing. Geen databasemigratie.

## Controles

- `node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/web/lib/plan-analysis.test.ts apps/web/lib/symbol-match.test.ts apps/web/lib/heat-loss.test.ts`
- `TSX_TSCONFIG_PATH=apps/api/tsconfig.json node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/src/catalog.test.ts`
- Web- en API-build.
- Browsercontrole met een lokaal techniekenplan: tekstuitlezing, bron, kalibratie, polygoon, telling en JSON-export. Netwerkcontrole: geen externe requests en geen plan-upload. Mobiel, tablet en desktop gecontroleerd.
