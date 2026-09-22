# Vérifier un bien / une adresse — note d’implémentation

Date : 2026-09-21. Vertical immobilier implémenté à partir de `2026-09-real-estate.md`.
Aucune clé API, aucune dépendance ajoutée. Réseau uniquement dans `scripts/open-data-address.ts` et
`POST /api/address` (utilisateur, rate-limité) ; les pages ne lisent que SQLite.

## Fichiers

- `src/lib/address.ts` — géocodage BAN, parcelle, DVF, DPE, risques, zonage + lectures cachées.
- `scripts/open-data-address.ts` — chaîne complète pour une adresse, imprime un résumé.
- `src/app/api/address/route.ts` — `{ q }` → meilleure correspondance (chaîne complète) et `{ banId }` ;
  requête ambiguë → jusqu’à 5 candidats du géocodeur, non stockés.
- `src/components/AddressSearch.tsx`, `src/app/verifier-un-bien/page.tsx`, `src/app/bien/page.tsx`,
  `src/app/bien/[id]/page.tsx`.

## Clé canonique

On utilise l’`id` BAN du géocodeur (ex. `95127_1448_00008`) comme clé `addresses.ban_id` et paramètre
`/bien/[id]` : c’est exactement l’`identifiant_ban` exposé par l’ADEME pour le DPE, donc la jointure
adresse↔DPE est déterministe. Le `banId` (UUID) n’est pas utilisé.

## Endpoints re-vérifiés live (2026-09-21)

| Bloc | Endpoint | Statut | Match |
|---|---|---|---|
| BAN | `data.geopf.fr/geocodage/search?q=&limit=` | 200 | CERTAIN (housenumber), sinon POSSIBLE |
| Parcelle | `apicarto.ign.fr/api/cadastre/parcelle?geom=<Point lon,lat>` | 200 | CERTAIN (point-in-polygon) |
| DVF | `dvf-api.data.gouv.fr/mutations/{insee}/{prefixe}{section}` puis filtre `id_parcelle === idu` | 200 | POSSIBLE |
| DPE | `data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?qs=identifiant_ban:<id>` | 200 | PROBABLE |
| Risques | `georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=<lon>,<lat>` | 200 après retries | POSSIBLE |
| Urbanisme | `apicarto.ign.fr/api/gpu/zone-urba?geom=<Point lon,lat>` | 200 | CERTAIN |

Détails utiles constatés :

- DVF `/mutations/{insee}/{section}` renvoie **toute la section** (248 lignes pour `95127/000BA`), pas la
  parcelle : le filtre sur `id_parcelle` est indispensable. Paris 7 (`75107/000BT`) renvoie `[]` :
  dégradation en 0 mutation sans erreur.
- `qs=adresse_ban:...` sur data-fair ne filtre pas : on filtre sur `identifiant_ban` exact, avec repli
  plein-texte `q=` puis re-filtre sur `identifiant_ban`/`adresse_ban`.
- Géorisques est instable (échec HTTP/2) : `fetchJson` retries=4, échec → 0 risque, jamais d’exception.
  `latlon` = **longitude d’abord**.
- Schéma `db.ts` non modifié : `transactions.id_parcelle` est le pivot DVF, `urban_zones`/`risks`
  indexés par `ban_id`. Contrainte `rgpd_notes` de la recherche : ventes présentées comme indice
  (`POSSIBLE`), jamais comme le prix d’un logement.

## Exemples réels synchronisés

- `8 boulevard du Port, 95000 Cergy` → BAN `95127_1448_00008`, parcelle `95127000BA0147` (1 482 m²),
  6 mutations DVF, 0 DPE, 9 risques, 1 zone (`UH2`).
- `36 Boulevard du Port 95000 Cergy` → BAN `95127_1448_00036`, parcelle `95127000AZ0323`,
  0 mutation, 20 DPE (C/C au 2025-01-24), 9 risques, 1 zone (`UH1`).
- `95 Avenue de Suffren 75007 Paris` (via `POST /api/address`) → BAN `75107_9114_00095`,
  parcelle `75107000BT0001`, risques + zone `UG`, indexable.

## Dégradations

- DPE pour `8 Bd du Port` : aucun diagnostic à l’adresse exacte → bloc vide (pas d’erreur).
- Certaines sections DVF (Paris 7 BT) vides → bloc Ventes vide.
- Géorisques : environ un appel sur deux échoue au premier essai ; les retries suffisent.

## Indexation

`addressIndexable(banId)` : vrai si au moins un bloc sourcé existe (DPE, transaction via la parcelle,
risque, zonage). Sinon `robots: index:false` (déterministe, sans IA). Les hubs `/bien` et
`/verifier-un-bien` ne listent que le cache, sans appel réseau au rendu.
