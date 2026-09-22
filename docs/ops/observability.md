# Observabilité locale

Deux commandes de lecture seule, sans réseau et sans écriture (hors schéma créé par `getDb()`),
pour suivre l'état du graphe et du cache open data sans base externe ni dashboard.

## `npm run legal-graph:stats`

Imprime un rapport **déterministe** (mêmes données → mêmes chiffres) de tout le graphe :
graphe juridique (`graphMetrics` de `src/lib/legal-graph.ts`) + volumétrie des tables open data.

- **Sortie lisible** (défaut) : ARTICLES, DECISIONS, `DECISION_ARTICLE_EDGES`,
  `ARTICLE_ARTICLE_EDGES`, citations, taux de résolution, `UNRESOLVED_REFERENCES`,
  `AMBIGUOUS_REFERENCES` (sans code), `ORPHANS`, `DUPLICATES`, puis entreprises / conventions /
  adresses et le reste des tables (`entities`, `source_records`, `parcels`, `dpe_diagnostics`…).
- **`--json`** : même contenu en JSON brut, stable, pour la CI.
- **Lecture** : un `Taux de résolution` bas avec beaucoup d'`UNRESOLVED_REFERENCES` signifie que des
  codes cités ne sont pas encore importés ; `ORPHANS` mesure les articles sans décision ni FAQ ;
  `DUPLICATES` les décisions republiées à fusionner. Une table absente ou vide compte `0`.
- Ne stocke rien (pas de `graph_snapshots` ici : c'est `npm run legal-graph` qui le fait).

## `npm run open-data:health`

Contrôle **local** du cache `source_records` pour chaque entrée du registre `SOURCES`
(`src/lib/sources.ts`). **Aucun appel réseau** : on ne compte que ce que SQLite contient déjà.

- Par source : provider, dataset, licence, lignes, dernière synchro, fraîches / périmées, TTL,
  et état (`à jour`, `partiellement périmé`, `à rafraîchir`, `import (pas de TTL)`, `aucune donnée`).
  Il n'existe pas de table d'erreurs : une source sans ligne fraîche est affichée `à rafraîchir`.
- Global : total `source_records`, lignes avec `payload`, lignes sans `checksum` (imports batch),
  et nombre d'entités par type (`entities.type`).
- **`--json`** : tout en JSON brut, pour la CI.
- **Code de sortie** : `1` si une source a des lignes mais qu'elles sont toutes périmées au-delà de
  **2× son TTL** (`overdue`), sinon `0`.

## Ajouter une source au contrôle de santé

1. Déclarer la source dans `SOURCES` (`src/lib/sources.ts`) avec la clé `"<provider>:<dataset>"`,
   `provider`, `dataset`, `name`, `url`, `licence` et `ttl` (secondes).
2. Écrire via `saveSourceRecord` / `recordImport` (`src/lib/sources.ts`) pour que les lignes
   apparaissent dans `source_records` avec ce couple `provider` / `dataset`.

C'est tout : `open-data:health` itère sur `SOURCES`, n'a rien de codé en dur, et signalera
automatiquement les lignes hors registre sous « Sources hors registre ».
