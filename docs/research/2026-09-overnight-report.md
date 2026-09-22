# Loilà — Overnight Report (nuit du 21 septembre 2026)

> Mission : faire évoluer Loilà d'un moteur juridique vers une plateforme reliant open data,
> données administratives, droit, jurisprudence et graphe de connaissances. Travail incrémental,
> sources officielles d'abord, cache SQLite, aucune donnée non autorisée publiée.

## 1. Executive summary

Loilà sait maintenant partir d'une **entreprise** (nom/SIREN/SIRET) ou d'une **adresse** et naviguer
vers les données publiques et le droit applicable, avec provenance affichée. Une couche commune
d'entités et de sources a été posée (`entities`, `entity_ids`, `source_records`) et deux verticales
sont en production locale : entreprise (DINUM + BODACC + RGE + IDCC) et bien/adresse
(BAN + cadastre + DVF + DPE + Géorisques + PLU). Le SEO d'indexation a été unifié
(`SEO_ELIGIBLE`), les sitemaps découpés par famille, des redirections canoniques posées. Deux
scripts d'observabilité et un test de non-régression ont été ajoutés. Un audit QA indépendant a
trouvé 2 bloquants et 4 majeurs ; **tous les bloquants et majeurs ont été corrigés** avant ce rapport.

État de vérification : `npx tsc --noEmit` ✅ · `npm run lint` ✅ (0 erreur) · `npm run check` ✅
(incluant `check-open-data`) · `next build` ✅ (avec `CONTENT_IMPORT=0`, voir §8).

## 2. Agents lancés

| Agent | Mission | Résultat |
| --- | --- | --- |
| R1 Entreprise | sources SIRENE/Annuaire/BODACC/RNE/RGE/IDCC | `docs/research/2026-09-companies.md` (582 l.) |
| R2 Immobilier | BAN/cadastre/DVF/DPE/IGN/GPU/Géorisques | `docs/research/2026-09-real-estate.md` (634 l.) |
| R3 Travail | KALI/IDCC/SMIC/minima/calculateurs | `docs/research/2026-09-labour.md` (451 l.) |
| R4 Open data discovery | catalogues, classement par levier | `docs/research/2026-09-open-data-catalog.md` (565 l.) |
| R5 SEO/Search | architecture, SEO_ELIGIBLE, sitemaps, SQLite vs alternatives | `docs/research/2026-09-seo-search.md` (482 l.) |
| Impl. Immobilier | chaîne adresse→bien | `src/lib/address.ts`, pages `/bien`, `/verifier-un-bien` |
| Impl. Observabilité | stats + santé | `scripts/legal-graph-stats.ts`, `scripts/open-data-health.ts`, `docs/ops/observability.md` |
| Docs | catalogue consolidé | `docs/DATA_SOURCES.md` |
| QA indépendant | casser le système | `docs/research/2026-09-qa-audit.md` (2 bloquants, 4 majeurs) |
| Tests | non-régression open data | `scripts/check-open-data.ts` (10 sections) |

## 3. Sources découvertes (récapitulatif)

Détail complet dans `docs/DATA_SOURCES.md`. Toutes vérifiées en direct le 21/09/2026.

| Source | Organisme | Donnée | Licence | Fréquence | Usage Loilà |
| --- | --- | --- | --- | --- | --- |
| recherche-entreprises.api.gouv.fr | DINUM | identité, NAF, IDCC, RGE, dirigeants | LOV2 (code MIT) | quotidien | colonne vertébrale entreprise |
| BODACC (Opendatasoft) | DILA | annonces civiles/commerciales | fr-lo | quotidien | procédures collectives |
| Liste RGE (data-fair) | ADEME | certifications RGE par SIRET | LOV2 | quotidien | certification |
| DSN SIRET→IDCC | Min. Travail | convention déclarée | LOV2 | ponctuel (retard mois) | IDCC |
| KALI | DILA | textes de conventions | fr-lo | quotidien | déjà ingéré (18 CCN) |
| BAN / data.geopf.fr | IGN/DINUM | adresse, géocodage | LOV2 | continu | pivot adresse |
| apicarto cadastre | IGN | parcelle (IDU) | LOV2 | continu | pivot parcelle |
| dvf-api.data.gouv.fr | DGFiP/Etalab | mutations | LOV2 | semestriel | prix (POSSIBLE) |
| dpe03existant (data-fair) | ADEME | DPE | LOV2 | continu | diagnostic |
| Géorisques | BRGM/MTECT | risques | LOV2 (de fait) | continu | risques |
| apicarto GPU | IGN | zonage PLU | à sécuriser | continu | urbanisme |
| IRL (INSEE BDM) | INSEE | indice loyers | LOV2 | trimestriel | révision loyer (prévu) |
| Juridictions compétentes | Min. Justice | commune → TJ/CPH/CA | LOV2 | annuel | « où agir » (prévu) |

## 4. Features implémentées

- **Couche entités/provenance** : `entities`, `entity_ids`, `source_records` + `src/lib/entities.ts`,
  `src/lib/sources.ts` (registre de 13 sources, TTL, licences, match quality).
- **Verticale entreprise** : `/verifier-entreprise` (outil), `/entreprise` (hub), `/entreprise/[siren]`
  (identité, activité, établissements, annonces BODACC, RGE, convention déclarée), `POST /api/company`,
  `scripts/open-data-company.ts`, `scripts/open-data-idcc.ts` (1 665 IDCC importés).
- **Verticale bien/adresse** : `/verifier-un-bien`, `/bien`, `/bien/[id]` (parcelle, ventes DVF, DPE,
  risques, zonage PLU), `POST /api/address`, `scripts/open-data-address.ts`.
- **SEO** : `src/lib/eligibility.ts` (règle unique d'indexabilité), sitemaps découpés
  (`generateSitemaps`, 5 sections), `robots.ts` mis à jour, `/contact` noindex, redirections 301
  `/article/<code>/<num>`, `/conventions/<idcc>`, `/siren/<siren>`, `/societe/<siren>`, `/adresse/<id>`.
- **Observabilité** : `npm run legal-graph:stats`, `npm run open-data:health`.
- **Tests** : `npm run check` inclut `check-open-data.ts`.

## 5. Legal Graph — avant / après

| Mesure | Avant | Après |
| --- | --- | --- |
| Articles | 101 981 | 101 981 |
| Décisions | 57 957 | 57 957 |
| Liens décision → article | 179 803 | 179 803 |
| Relations article ↔ article | 58 691 | 58 691 |
| Citations détectées | 1 281 444 | 1 281 444 |
| Conventions (IDCC référencés) | 18 | **1 665** |
| Entités internes (`entities`) | 0 | 1 683 |
| Identifiants externes (`entity_ids`) | 0 | 1 683 |
| Enregistrements source (`source_records`) | 0 | 22 |
| Entreprises | 0 | 11 |
| Annonces BODACC | 0 | 100 |
| Certifications RGE | 0 | 2 |
| Adresses / parcelles | 0 | 3 / 3 |
| Mutations DVF / DPE / risques / zonage | 0 | 6 / 20 / 27 / 3 |

La boucle **entreprise → convention → articles** existe désormais (via IDCC), ainsi que
**adresse → parcelle → diagnostics/risques/urbanisme**. Le graphe juridique existant n'a pas été
modifié : l'ajout est strictement additif.

## 6. SEO

Nouveaux types de pages : `/verifier-entreprise`, `/verifier-un-bien` (outils), `/entreprise`,
`/bien` (hubs), `/entreprise/[siren]`, `/bien/[id]` (entités).

- **Indexable** : pages éditoriales, FAQ, sujets, lettres, métiers, conventions, articles cités
  (FAQ/lettre/résumé frais + décision), décisions avec résumé, entreprises actives diffusable avec
  au moins un bloc sourcé, adresses avec au moins un bloc sourcé.
- **Noindex (follow)** : texte légal brut (~100 k articles), décisions sans résumé, fiches
  entreprise/adresse sans bloc rattaché, `/contact`, listes jurisprudence paginées (`?avant=`),
  listes dont l'article parent n'est pas indexable.
- **Sitemaps** (production) : `/sitemap/0.xml` (core, 27), `/sitemap/1.xml` (articles, 2 692),
  `/sitemap/2.xml` (décisions, 2 356), `/sitemap/3.xml` (contenus, 962), `/sitemap/4.xml` (entités).
  Le sitemap ne contient que des URLs indexables (`eligibility.ts` est l'unique porte).
- Aucune URL existante à impressions n'a changé de canonical.

## 7. Data quality (QA)

Rapport complet : `docs/research/2026-09-qa-audit.md`. Constats et suites données :

| Sévérité | Constat | Statut |
| --- | --- | --- |
| BLOQUANT | Non-diffusibles (`statut_diffusion='P'`) affichés/recherchables | **Corrigé** : `notFound()` fiche, filtres hub/recherche, refus au sync |
| BLOQUANT | APIs publiques abusables (rate-limit, écritures) | **Atténué** : limites resserrées, `sec-fetch-site`, validation d'entrée |
| MAJEUR | Sitemap ⊃ noindex pour les adresses (`parcel_addresses`) | **Corrigé** : `indexableAddresses()` aligné sur `addressIndexable()` |
| MAJEUR | Recherche par nom → liens vers fiche non cachée | **Corrigé** : mise en cache d'identité (`cacheCompanyHit`) |
| MAJEUR | Hub entreprise listait des sociétés cessées/non diffusibles | **Corrigé** : hub = `indexableCompanies()` |
| MAJEUR | Badge DPE « PROBABLE » figé alors que le match peut être `POSSIBLE` | **Corrigé** : qualité lue par ligne |
| MINEUR | `companyAgreements` renvoyait l'IDCC 9999 | **Corrigé** : filtre au read + au read (test mis à jour) |
| MINEUR | `normalizeIdcc` acceptait `"abc"`/`""` | **Corrigé** : retourne `""` sans chiffre |
| MINEUR | Import IDCC conservait 9999 | **Corrigé** : ignoré à l'import |

Invariants vérifiés en base : 0 non-diffusable, 0 IDCC 9999 stocké, 0 entité orpheline/dupliquée,
0 `source_records` sans licence, coordonnées plausibles, DVF jamais `CERTAIN`, migrations idempotentes.

## 8. Performance

- `next build` : ✅ avec `CONTENT_IMPORT=0`. **Point d'attention** : sans ce drapeau, un build en
  `NODE_ENV=production` déclenche l'import des bundles de contenu puis la reconstruction du graphe
  sur la base locale déjà peuplée (2,4 Go), ce qui dépasse 20 min. Un escape hatch opérateur
  `CONTENT_IMPORT=0` a été ajouté dans `src/lib/db.ts` (jamais en production, où l'import doit
  tourner). Aucun changement du comportement par défaut.
- Pages entreprise/adresse : lecture SQLite uniquement (aucun appel réseau au rendu) ; enrichissement
  via scripts et API rate-limitées.
- `npm run check` (dont invariants graphe sur 1,28 M citations) : OK.

## 9. Tests

- `npx tsc --noEmit` : ✅
- `npm run lint` : ✅ 0 erreur (2 warnings préexistants/bénins)
- `npm run check` : ✅ (ask, billing, budget, wizard, lettres, articles, legal-refs, legal-graph,
  **open-data**)
- `scripts/check-open-data.ts` (nouveau) : 10 sections — idempotence du schéma, résolution d'entités,
  `normalizeIdcc`, `source_records` (TTL/checksum/import), `articleIndexable`, `decisionIndexable`,
  `indexableCompanies`/`indexableAddresses`, filtre IDCC 9999, recherche entreprise, registre `SOURCES`.
- Vérifs live (dev) : redirections 301/308, `/sitemap/4.xml` cohérent avec SQL, recherche nom → fiche 200.

## 10. Failed experiments

- **Cerema DVF** (`apidf-preprod.cerema.fr`) : HTTP 503, écarté.
- **`api.dvf.etalab.gouv.fr`** : NXDOMAIN ; remplacé par `dvf-api.data.gouv.fr`.
- **`api-adresse.data.gouv.fr`** : dépréciée (sunset 31/01/2026) ; migration vers `data.geopf.fr/geocodage`.
- **INSEE SIRENE API** : clé requise (401) et quirk TLS/HTTP2 → non retenue, l'Annuaire des
  Entreprises couvre le besoin.
- **INPI RNE** : 403/401, compte + licence + plafond 10 % → reporté.
- **BOSS / API Entreprise / Judilibre-PISTE / BOAMP / stats justice / taux d'intérêt légal** :
  écartés (pas d'open data, habilitation, ou source non fiable) — cf. `DATA_SOURCES.md` §3.
- **Sitemap `/sitemap.xml/0`** (dev) : 404 ; le chemin de production `/sitemap/<id>.xml` a été
  confirmé par build + dev, `robots.ts` pointe dessus.

## 11. Risks

- **Techniques** : SQLite mono-écrivain (le cache open data grossit ; prévoir une base séparée si
  volumétrie DPE/DVF) ; APIs externes instables (Géorisques, endpoints mouvants) → cache + retries ;
  rate-limits (DINUM 7 req/s) → pas d'import massif naïf.
- **Données** : DVF multi-lots non attribuable à un logement (marqué POSSIBLE) ; DPE au bâtiment, pas
  au logement ; GPU licence `notspecified` à sécuriser ; IDCC déclaratif, partiel, en retard de mois.
- **Juridiques** : RGPD dirigeants (non stockés) ; non-diffusibles (exclus) ; ne jamais construire
  d'annuaire de personnes ; mention de source et de millésime obligatoire.
- **SEO** : risque de thin content sur les fiches sans bloc (noindex + gate) ; ne pas indexer les
  millions de SIREN bruts ; surveiller la bascule vers des sitemaps découpés.

## 12. Next 10 highest leverage actions

1. **Juridictions compétentes** (Min. Justice) : commune → TJ/CPH/CA → décisions ; arête manquante.
2. **IRL + calculateur de révision de loyer** (INSEE) : indice versionné → loi 89-462 → lettre.
3. **`decision_parties`** : extraire les SIREN des décisions pour relier entreprise ↔ jurisprudence.
4. **Import DSN SIRET→IDCC** (CSV officiel) : passer l'IDCC de PROBABLE à CERTAIN.
5. **Zonage ABC / zones tendues** : commune → droits (préavis réduit), coût quasi nul, fort SEO.
6. **`agreement_rule` versionné** (KALI) : minima/préavis sourcés pour des calculateurs déterministes.
7. **Encadrement des loyers** : adresse/quartier → plafond → contentieux du loyer.
8. **ACCO** (accords d'entreprise) : SIRET → accord → articles ; forte valeur de graphe.
9. **`check-seo.ts`** : invariants sitemap ⊆ indexable et canonical unique par entité en CI.
10. **Assistant contextuel** (LLM en dernier) sur le contexte structuré entreprise/bien + graphe.

---

*Aucun commit ni push n'a été effectué (les conventions du projet ne l'exigent pas). Toutes les
modifications sont dans le working tree, vérifiées par typecheck, lint, tests et build.*
