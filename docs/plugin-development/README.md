# Plugin Development Guide

Kopieer `plugins/sample-plugin` en wijzig minimaal `id`, `name`, `route`, permissions en menuvolgorde.

## Verplicht

- unieke kebab-case plugin-ID;
- semantische versie;
- eigen permission namespace;
- geen imports uit andere plugins;
- zelfstandig typechecken en testen;
- core moet zonder de plugin starten.

## Contractwijzigingen

Wijzigingen aan `packages/contracts` vereisen review door het platformteam en moeten achterwaarts compatibel zijn of een nieuwe API-versie introduceren.
