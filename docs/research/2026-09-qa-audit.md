# QA indépendante — travail open data du 21/09/2026

Auditeur : agent QA indépendant (n'a pas écrit le code). Périmètre : `src/lib/{db,sources,entities,company,address,eligibility}.ts`,
`src/app/api/{company,address}/route.ts`, `src/app/{entreprise,bien,verifier-entreprise,verifier-un-bien}/**`,
`sitemap.ts`, `robots.ts`, redirections `{siren,societe,adresse,conventions,article}`, `scripts/open-data-*.ts`,
`scripts/legal-graph-stats.ts`, `scripts/open-data-health.ts`, docs 2026-09.

Méthode : lecture du code, `npx tsc --noEmit` (OK), requêtes SQL read-only sur `data/loila.db`, tests ciblés.
Aucune écriture hors ce fichier.

---

## Verdict court

Pas de BLOQUANT de données (la base est propre : voir §7). **Deux BLOQUANTS de conformité/abus** et plusieurs MAJEUR.
**Non, pas shippable en l’état** sans les correctifs 1–3 ci-dessous.

---

## 1. BLOQUANT — RGPD : les entreprises non diffusibles (`statut_diffusion = 'P'`) sont quand même publiées

- `src/lib/company.ts:200` `getCompany()` ne filtre pas ; `src/lib/company.ts:257-268` `searchCompanies()` ne filtre ni `etat_administratif` ni `statut_diffusion`.
- `src/app/entreprise/[siren]/page.tsx:47-66` rend la fiche complète dès qu’une ligne existe ; aucun `notFound()` pour `statut_diffusion === 'P'`.
- `src/app/api/company/route.ts:28-39` synchronise et renvoie le SIREN sans refuser P.
- `src/lib/eligibility.ts:92`, `src/lib/company.ts:247` n’utilisent P que pour le `noindex`. La page reste servie en 200 et liée depuis le hub.
- Contredit la règle écrite : `docs/DATA_SOURCES.md` §4.2 « `statut_diffusion = 'P'` … à ne jamais réafficher ».
- Preuve : `grep` ne trouve que des usages de désindexation ; aucune garde de rendu. `SELECT count(*) FROM companies WHERE statut_diffusion='P'` = 0 *aujourd’hui* (dev), donc impact conditionnel à un retour P par l’API DINUM — mais c’est justement ce que le champ défensif est censé couvrir.

**Correctif** : dans la page et `searchCompanies`/`getCompany`, exclure `statut_diffusion = 'P'` (et les entreprises non diffusibles) ; renvoyer `notFound()` ; ne pas stocker ces lignes (`syncCompany`) ; filtrer `searchCompanies`.

## 2. BLOQUANT — Endpoints publics en écriture : rate-limit contournable + `sameOrigin` décoratif

- `src/lib/auth.ts:30-32` `clientIp()` prend le **premier** `x-forwarded-for`, contrôle du client. Derrière un proxy qui ajoute l’IP réelle (`"<faux>, <réel>"`), la clé change à chaque requête → **rate-limit 30/min ignoré**.
- `src/lib/auth.ts:46-55` `sameOrigin()` accepte `x-forwarded-host` fourni par le client ; un `curl` envoie `Origin: https://loila.fr` (ou un `X-Forwarded-Host` arbitraire) et passe.
- `src/lib/auth.ts:34-43` rate-limit **en mémoire, mono-instance** (le commentaire l’assume) : inopérant en multi-instance / serverless (cold start).
- Effet : `POST /api/company` déclenche jusqu’à 3 fetches + écritures ; `POST /api/address` (`src/app/api/address/route.ts:34`) déclenche ~6 fetches et écrit `addresses/parcels/parcel_addresses/transactions/dpe/risks/urban_zones` + `source_records.payload`. Requêtes non authentifiées, DB partagée → **appels amont illimités, écritures/stockage non bornés, pollution du cache**. Combiné au §3, permet d’injecter des URLs dans le sitemap.
- Pas de SSRF (hôtes fixes, `encodeURIComponent`, `idu` validé `^\d{5}\d{3}[0-9A-Z]{2}\d{4}$`) : sur ce point précis, c’est correct.
- Longueurs d’entrée bornées (120/160) : correct. Erreurs : messages génériques, pas de fuite : correct.

**Correctif** : ne faire confiance qu’au hop proxy de confiance (plateforme/IP socket), rate-limit partagé (Redis/DB), ajouter Turnstile sur les POST, borner les écritures par IP.

---

## 3. MAJEUR — Sitemap ⊃ noindex pour les adresses

- `src/lib/eligibility.ts:101-110` (`indexableAddresses`, utilisé par `sitemap.ts:76`) inclut toute adresse ayant **une ligne `parcel_addresses`**.
- `src/lib/company.ts:406-414` / `src/app/bien/[id]/page.tsx:43` (`addressIndexable`, utilisé pour `robots`) exige un vrai bloc : DPE, risque, zone, **ou transaction via parcelle**. Le hub `/bien` (`src/app/bien/page.tsx:24-27`) utilise, lui, la règle stricte.
- Or `syncAddressFull` (`src/lib/address.ts:309-327`) crée une parcelle à presque chaque géocodage réussi. Une adresse avec parcelle mais sans DPE/risque/zone/DVF (courant : pas de PLU, DPE<2021, DVF absent en Alsace-Moselle) entre au sitemap alors que sa page est `robots: index:false` → contradiction directe avec l’invariant documenté (`src/lib/eligibility.ts:2-3`, `2026-09-seo-search.md` §3.8).
- Preuve SQL (dev) : divergence = 0 aujourd’hui (les 3 adresses ont des blocs), mais la condition apparaîtra. Requête de contrôle fournie dans l’audit.
- Aggravé par le §2 : un tiers peut créer des adresses/parcelles à volonté → **spam de sitemap avec des pages noindex**.

**Correctif** : supprimer la branche `parcel_addresses` de `indexableAddresses()` (garder dpe/risk/zone/transaction-via-parcelle), ou l’aligner strictement sur `addressIndexable`. Ajouter un test `check-seo` : toute URL du sitemap ⇒ page indexable (et réciproquement).

## 4. MAJEUR — Recherche par nom : résultats DINUM jamais mis en cache → liens morts

- `src/app/api/company/route.ts:42-54` : si le cache local est vide, renvoie les hits DINUM **sans les stocker** (commentaire ligne 14-15 : « the detail page syncs the chosen SIREN » — **faux**, aucune page ne synchronise).
- `src/components/CompanySearch.tsx:93,77` lie vers `/entreprise/{siren}` ; `src/app/entreprise/[siren]/page.tsx:52-66` affiche « Fiche pas encore disponible » (200) car la page ne lit que SQLite.
- Sur une base fraîche, **toute** recherche par nom mène à une page vide : la promesse « Recherchez n’importe quelle entreprise par son nom » (`entreprise/page.tsx:55-56`) est cassée.

**Correctif** : synchroniser le SIREN sélectionné côté serveur (route `POST` dédiée ou à l’ouverture de la fiche), ou ne renvoyer que les hits déjà en cache.

## 5. MAJEUR — Hub `/entreprise` incohérent avec les règles d’indexabilité (et avec le RGPD)

- `src/app/entreprise/page.tsx:20-29` liste toute entreprise ayant un bloc, **sans filtrer `etat_administratif='A'` ni `statut_diffusion<>'P'`**, alors que le sitemap (`eligibility.ts:88-98`) et `companyIndexable` les excluent.
- Le hub est lui-même indexable (`CollectionPage`, `ItemList`) et expose donc des noms d’entreprises cessées/non diffusibles.

**Correctif** : réutiliser `indexableCompanies()` pour le hub, comme `/bien` réutilise la règle stricte.

## 6. MAJEUR (mineur fonctionnel) — DPE texte-fallback `POSSIBLE` affiché sous un badge `PROBABLE`

- `src/lib/address.ts:228` stocke `POSSIBLE` quand `identifiant_ban !== banId` (fallback plein texte).
- `src/app/bien/[id]/page.tsx:203` badge **codé en dur** `matchQuality="PROBABLE"` ; la page n’affiche jamais `d.match_quality`. Le fallback moins fiable est donc surévalué d’un cran dans l’UI.

**Correctif** : calculer le badge à partir du `match_quality` max des lignes, ou afficher la qualité par ligne.

---

## 7. Vérifications de données (SQL) — majoritairement PROPRE

Sur `data/loila.db` :
- `statut_diffusion='P'` : 0. `company_agreements` : 0 ligne `9999`, toutes 4 chiffres (`length(idcc)=4` sur les 1665 `collective_agreements`). `collective_agreements` : 9999 absent.
- `source_records` licence : colonne `NOT NULL`, 0 NULL/vide. Coordonnées : 0 aberration (`lat/lon` Paris/Cergy cohérents). DVF : **toutes `match_quality='POSSIBLE'`** — jamais CERTAIN, conforme (`src/lib/address.ts:156,149` hardcode POSSIBLE).
- `entities` = 1673, `entity_ids` = 1673, 0 orphelin, 0 `entity_id` cassé, pas de doublon (PK `(scheme,value)`), pas de même IDCC mappé sur 2 entités.
- Migration idempotente : `SCHEMA` en `CREATE TABLE/INDEX IF NOT EXISTS` + `addCols()` par `PRAGMA table_info` (`src/lib/db.ts:694-712`). Ouvrir la base deux fois ne casse rien.
- Chaîne Géorisques : `latlon=<lon>,<lat>` correct, `retries:4` (`src/lib/address.ts:247,250`), échec → 0 ligne, jamais d’exception ; les pages ne font aucun réseau (lecture SQLite).
- DVF : requête par section puis **filtre exact `id_parcelle === idu`** (`address.ts:148`) ; aucune attribution à un logement précis ; note UI « indice, jamais la preuve » (`bien/[id]/page.tsx:173`).
- Redirections : pas de boucle. `/article/[id]/jurisprudence` (segment statique) prime sur `/article/[id]/[num]` ; alias 301 vers le canonique. `robots.ts` liste `/sitemap/0..4.xml`, conforme à `generateSitemaps` (ids 0..4) — corrige l’ancien renvoi vers `/sitemap.xml`.
- Règles noindex article/décision : `texte_sha` vérifié (`eligibility.ts:42-48,57-59`) et parent vérifié pour les listes (`:82-85`) — les bugs §1.2a/1.2b de `2026-09-seo-search.md` sont bien corrigés.
- `npx tsc --noEmit` : **0 erreur**.

## 8. Autres constats

- **MINEUR** `normalizeIdcc` (`entities.ts:53`) ne valide pas : `""` → `"0000"`, `"abc"` → `"0abc"` ; `listIdcc` (`company.ts:39`) ne filtre que `9999`. Une valeur vide/non numérique DINUM fuiterait dans `company_agreements`. Filtrer `^\d{4}$` et `!== 9999`.
- **MINEUR** `scripts/open-data-idcc.ts:40` n’écarte pas `9999` à l’import (absents aujourd’hui) ; et sa source `DINUM:idcc-metadata` n’est pas dans `SOURCES` (`sources.ts:38-143`) → `open-data:health` la classe « hors registre » et ne suit pas son TTL.
- **MINEUR** Règle liste jurisprudence : sitemap `decisions > 6` (`eligibility.ts:76`) vs page `decisions >= 1` (`:84`) et doc §3.3 → des pages indexables (1–6 décisions) sont absentes du sitemap. Divergence inverse (non bloquante) mais à unifier.
- **MINEUR** IDCC déclaré par DINUM mais absent du référentiel (ex. EDF `5001`) affiché « Convention IDCC 5001 » sans titre, avec un lien `KALICONT5001` possiblement mort (`entreprise/[siren]/page.tsx:163,187`). N’afficher/lier que les IDCC présents dans `collective_agreements`.
- **MINEUR** `searchCompanies` LIKE `%q%` sans échapper `%`/`_` ; `syncCompany` (`company.ts:69-122`) ne vérifie pas que le SIREN renvoyé correspond au SIREN/SIRET interrogé. Risque faible (test live d’un 14 chiffres bidon → `results:[]`) mais aucune assertion d’identité.
- **MINEUR** Soft 404 : `/bien/<inconnu>` et `/entreprise/<inconnu>` renvoient 200 (placeholder) au lieu de `notFound()` (`bien/[id]/page.tsx:50-64`, `entreprise/[siren]/page.tsx:52-66`).
- **MINEUR** `syncDpeForAddress` réécrit `ban_id` avec l’adresse interrogée même quand `identifiant_ban` diffère (`address.ts:225`) : un DPE `POSSIBLE` perd son vrai BAN id.
- **NIT** `isSiren`/`isSiret` (`company.ts:19-20`) : test `length` redondant après `/^\d{n}$/`. `fetchJson` (`sources.ts:216-232`) retente aussi les 4xx. `commercant` et `jugement` (blobs BODACC, données personnelles possibles) sont stockés mais jamais rendus : acceptable, à documenter.
- **NIT** Aucun test pour les nouveaux modules ; les `scripts/check-*.ts` ne couvrent ni `eligibility`, ni `company`, ni `address`. `tsc` seul ne valide pas la logique d’indexabilité.

---

## Top 5 correctifs par priorité

1. **RGPD non diffusibles** : `notFound()` + filtres `statut_diffusion<>'P'`/état A dans `entreprise/[siren]`, `searchCompanies`/`getCompany`, hub, et `syncCompany`. (BLOQUANT 1)
2. **Durcir `/api/company` et `/api/address`** : IP de confiance (pas le 1er XFF), rate-limit partagé, Turnstile, bornage des écritures ; sinon cache/sitemap empoisonnables. (BLOQUANT 2)
3. **Aligner `indexableAddresses()` sur `addressIndexable()`** + test d’invariant « sitemap ⊆ indexable » dans `npm run check`. (MAJEUR 3)
4. **Réparer la recherche par nom** : synchroniser le SIREN choisi, ou ne lier que le cache. (MAJEUR 4)
5. **Unifier le hub `/entreprise`** sur `indexableCompanies()` et **remonter la qualité DPE réelle** (badge par ligne). (MAJEUR 5-6)
